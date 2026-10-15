"""Single-dispatch worker for a saved, isolated Blender scene. Never retries."""
import hashlib
import json
import os
from pathlib import Path
import traceback


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def run(request_path):
    import bpy
    request_path = Path(request_path)
    request_hash = digest(request_path)
    request = json.loads(request_path.read_text(encoding="utf-8"))
    # Claim first: even preflight failure cannot be blindly replayed.
    with open(str(request_path) + ".started", "x", encoding="utf-8") as claim:
        claim.write(str(os.getpid()))
    receipt = {key: request[key] for key in (
        "job_id", "iteration_id", "nonce", "source_sha256", "script_sha256")}
    receipt.update(request_sha256=request_hash, pid=os.getpid(),
                   blender_version=bpy.app.version_string)
    try:
        if digest(request["worker"]) != request["worker_sha256"]:
            raise ValueError("Worker changed")
        if request["blender_version"] and request["blender_version"] != bpy.app.version_string:
            raise ValueError("Blender version changed")
        if Path(bpy.data.filepath).resolve() != Path(request["source"]).resolve() or bpy.data.is_dirty:
            raise ValueError("Expected saved clean source scene; preserve user scene")
        for key in ("source", "script"):
            if digest(request[key]) != request[key + "_sha256"]:
                raise ValueError(key + " changed")
        output = Path(request["output"])
        if output.exists():
            raise ValueError("Output exists; refusing overwrite")
        output.parent.mkdir(parents=True, exist_ok=True)
        scope = {"bpy": bpy, "request": request, "__name__": "__workflow_operation__"}
        exec(compile(Path(request["script"]).read_text(encoding="utf-8"), request["script"], "exec"), scope)
        if not output.exists() and output.suffix.lower() == ".blend":
            bpy.ops.wm.save_as_mainfile(filepath=str(output))
        if not output.is_file():
            raise ValueError("Operation did not produce reserved output")
        if digest(request["source"]) != request["source_sha256"]:
            raise ValueError("Operation modified original source")
        receipt.update(status="completed", output=str(output), output_sha256=digest(output),
                       scene=bpy.context.scene.name)
        receipt["inventory"] = {
            "objects": [{"name": obj.name, "type": obj.type,
                         "vertices": len(obj.data.vertices) if obj.type == "MESH" else None,
                         "polygons": len(obj.data.polygons) if obj.type == "MESH" else None,
                         "bones": len(obj.data.bones) if obj.type == "ARMATURE" else None}
                        for obj in bpy.context.scene.objects],
            "actions": [a.name for a in bpy.data.actions],
            "frame_range": [bpy.context.scene.frame_start, bpy.context.scene.frame_end],
            "scope": "Current scene inventory only; not export readback or quality approval"}
    except BaseException:
        receipt.update(status="failed", error=traceback.format_exc())
    target = Path(request["receipt"])
    temp = target.with_suffix(".tmp")
    with open(temp, "x", encoding="utf-8") as stream:
        json.dump(receipt, stream, ensure_ascii=False, indent=2)
    os.replace(temp, target)
    print(json.dumps({"execution_receipt": str(target), "status": receipt["status"]}))
    if receipt["status"] == "failed":
        raise RuntimeError(receipt["error"])
    return receipt


if __name__ == "__main__":
    import sys
    run(sys.argv[sys.argv.index("--") + 1])
