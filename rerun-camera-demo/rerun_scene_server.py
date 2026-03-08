#!/usr/bin/env python3
"""Rerun-backed moving camera + cube scene demo.

This process only logs data to a Rerun gRPC endpoint.
A separate `rerun --serve-web` process hosts the interactive viewer for LAN clients.
"""

from __future__ import annotations

import math
import os
import time
from dataclasses import dataclass

import numpy as np
import rerun as rr
import rerun.blueprint as rrb


@dataclass(frozen=True)
class Config:
    app_id: str = os.environ.get("RERUN_APP_ID", "rerun_lan_scene")
    grpc_addr: str = os.environ.get("RERUN_GRPC_ADDR", "rerun+http://127.0.0.1:9876/proxy")
    fps: float = float(os.environ.get("RERUN_FPS", "30"))


def look_at_rotation(camera_pos: np.ndarray, target: np.ndarray) -> np.ndarray:
    """Return a world-space rotation matrix for a +Z forward camera frame."""
    forward = target - camera_pos
    forward = forward / np.linalg.norm(forward)

    world_up = np.array([0.0, 0.0, 1.0], dtype=np.float32)
    right = np.cross(forward, world_up)
    if np.linalg.norm(right) < 1e-6:
        world_up = np.array([0.0, 1.0, 0.0], dtype=np.float32)
        right = np.cross(forward, world_up)
    right = right / np.linalg.norm(right)

    up = np.cross(right, forward)
    return np.column_stack((right, up, forward)).astype(np.float32)


def send_blueprint() -> None:
    rr.send_blueprint(
        rrb.Blueprint(
            rrb.Horizontal(
                rrb.Spatial3DView(origin="/world", name="3D Scene"),
                rrb.TimeSeriesView(origin="/metrics", name="Camera Metrics"),
                column_shares=[4, 2],
            ),
            collapse_panels=False,
        )
    )


def log_static_scene() -> None:
    rr.log("world", rr.ViewCoordinates.RIGHT_HAND_Z_UP, static=True)

    rr.log(
        "world/grid",
        rr.LineStrips3D(
            [
                [[x, -2.5, 0.0], [x, 2.5, 0.0]]
                for x in np.linspace(-2.5, 2.5, 21)
            ]
            + [
                [[-2.5, y, 0.0], [2.5, y, 0.0]]
                for y in np.linspace(-2.5, 2.5, 21)
            ],
            colors=[[50, 75, 95]],
            radii=[0.002],
        ),
        static=True,
    )

    rr.log(
        "world/cube",
        rr.Boxes3D(
            centers=[[0.0, 0.0, 0.5]],
            half_sizes=[[0.4, 0.4, 0.4]],
            colors=[[70, 170, 255]],
            labels=["target cube"],
        ),
        static=True,
    )

    rr.log(
        "world/axes",
        rr.Arrows3D(
            vectors=[[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]],
            colors=[[255, 80, 80], [80, 255, 120], [90, 150, 255]],
            radii=[0.02],
        ),
        static=True,
    )

    rr.log(
        "world/camera",
        rr.Pinhole(
            resolution=[1280, 720],
            focal_length=[800.0, 800.0],
        ),
        static=True,
    )


def run() -> None:
    cfg = Config()

    rec = rr.RecordingStream(cfg.app_id)
    rec.connect_grpc(cfg.grpc_addr)
    rr.set_global_data_recording(rec)

    send_blueprint()
    log_static_scene()

    frame = 0
    t0 = time.perf_counter()
    trail: list[list[float]] = []

    dt = 1.0 / max(cfg.fps, 1.0)
    while True:
        sim_t = time.perf_counter() - t0

        rr.set_time("frame_nr", sequence=frame)
        rr.set_time("sim_time", duration=sim_t)

        theta = sim_t * 0.7
        radius = 3.0 + 0.2 * math.sin(sim_t * 0.3)

        cam = np.array(
            [
                radius * math.cos(theta),
                radius * math.sin(theta),
                1.4 + 0.6 * math.sin(sim_t * 0.8),
            ],
            dtype=np.float32,
        )
        target = np.array([0.0, 0.0, 0.5], dtype=np.float32)

        rr.log(
            "world/camera",
            rr.Transform3D(
                translation=cam,
                mat3x3=look_at_rotation(cam, target),
                relation=rr.TransformRelation.ChildFromParent,
            ),
        )

        trail.append(cam.tolist())
        if len(trail) > 600:
            trail = trail[-600:]
        rr.log("world/camera_path", rr.LineStrips3D([trail], colors=[[255, 220, 80]], radii=[0.01]))

        rr.log("metrics/camera_radius", rr.Scalars(radius))
        rr.log("metrics/camera_height", rr.Scalars(float(cam[2])))

        frame += 1
        time.sleep(dt)


if __name__ == "__main__":
    run()
