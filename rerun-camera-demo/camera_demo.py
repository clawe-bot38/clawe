#!/usr/bin/env python3
import math
import os
import time

import numpy as np
import rerun as rr
import rerun.blueprint as rrb


def look_at_rotation(camera_pos: np.ndarray, target: np.ndarray) -> np.ndarray:
    forward = target - camera_pos
    forward = forward / np.linalg.norm(forward)

    world_up = np.array([0.0, 0.0, 1.0], dtype=np.float32)
    right = np.cross(forward, world_up)
    right = right / np.linalg.norm(right)
    up = np.cross(right, forward)

    # Columns are camera basis vectors in world-space.
    # Camera convention here: +X right, +Y up, +Z forward.
    return np.column_stack((right, up, forward)).astype(np.float32)


def main() -> None:
    rr.init("moving_camera_demo", spawn=False)

    grpc_addr = rr.serve_grpc()
    lan_host = os.environ.get("RERUN_HOST", "192.168.1.108")
    connect_addr = grpc_addr.replace("127.0.0.1", lan_host)

    rr.send_blueprint(
        rrb.Blueprint(
            rrb.Spatial3DView(origin="/", name="3D Scene"),
            collapse_panels=False,
        )
    )

    rr.serve_web_viewer(web_port=3000, open_browser=False, connect_to=connect_addr)

    # Static scene geometry
    rr.log("world/origin", rr.Points3D([[0.0, 0.0, 0.0]], colors=[[255, 60, 60]], radii=[0.06]))
    rr.log(
        "world/ring",
        rr.Points3D(
            positions=[
                [2.4 * math.cos(t), 2.4 * math.sin(t), 0.2 * math.sin(2.0 * t)]
                for t in np.linspace(0, 2 * math.pi, 200)
            ],
            colors=[[90, 200, 255]],
            radii=[0.01],
        ),
    )

    width, height = 1280, 720
    rr.log("world/camera", rr.Pinhole(focal_length=700, width=width, height=height))

    frame = 0
    trail: list[list[float]] = []
    while True:
        theta = frame * 0.03
        radius = 4.0
        cam = np.array(
            [
                radius * math.cos(theta),
                radius * math.sin(theta),
                1.2 + 0.5 * math.sin(theta * 0.6),
            ],
            dtype=np.float32,
        )
        target = np.array([0.0, 0.0, 0.4], dtype=np.float32)

        rr.set_time("frame", sequence=frame)
        rr.log(
            "world/camera",
            rr.Transform3D(
                translation=cam,
                mat3x3=look_at_rotation(cam, target),
                relation=rr.TransformRelation.ChildFromParent,
            ),
        )

        trail.append(cam.tolist())
        if len(trail) > 400:
            trail = trail[-400:]
        rr.log("world/camera_path", rr.LineStrips3D([trail], colors=[[255, 200, 40]]))

        frame += 1
        time.sleep(1 / 30)


if __name__ == "__main__":
    main()
