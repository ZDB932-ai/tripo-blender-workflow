"""Evaluate a named protected region in a common coordinate frame.

Caller supplies matching topology, frozen rest-pose indices, and asset-specific
limits. Remove intended whole-character motion before calling. This does not
check self-intersections, appearance, or skin normalization.
"""
import math


def evaluate_region(rest, posed, indices, *, scale, max_displacement_ratio,
                    max_width_change_ratio):
    if len(rest) != len(posed) or not rest:
        raise ValueError('Matching nonempty topology required')
    limits = (scale, max_displacement_ratio, max_width_change_ratio)
    if not all(math.isfinite(v) for v in limits) or scale <= 0 or min(limits[1:]) < 0:
        raise ValueError('Explicit finite scale and nonnegative limits required')
    ids = list(indices)
    if not ids or len(set(ids)) != len(ids) or any(type(i) is not int or i < 0 or i >= len(rest) for i in ids):
        raise ValueError('Nonempty unique valid region indices required')
    a, b = [rest[i] for i in ids], [posed[i] for i in ids]
    if any(len(p) != 3 or not all(math.isfinite(v) for v in p) for p in a + b):
        raise ValueError('Finite 3D positions required')
    displacement = max(math.dist(p, q) for p, q in zip(a, b)) / scale
    width_a = max(p[0] for p in a) - min(p[0] for p in a)
    width_b = max(p[0] for p in b) - min(p[0] for p in b)
    width_change = abs(width_b - width_a) / scale
    return {'status': 'pass' if displacement <= max_displacement_ratio and width_change <= max_width_change_ratio else 'fail',
            'vertex_count': len(ids), 'max_displacement_ratio': displacement,
            'width_change_ratio': width_change, 'scale': scale,
            'limits': {'max_displacement_ratio': max_displacement_ratio,
                       'max_width_change_ratio': max_width_change_ratio}}
