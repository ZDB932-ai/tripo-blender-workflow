import unittest
from deformation_guard import evaluate_region


class GuardTests(unittest.TestCase):
    def check(self, rest, posed, indices=(0, 1)):
        return evaluate_region(rest, posed, indices, scale=1,
                               max_displacement_ratio=.02, max_width_change_ratio=.03)

    def test_unrelated_arm_motion_does_not_fail_protected_belly(self):
        rest = [(-.2, 0, .5), (.2, 0, .5), (.3, 0, .7)]
        self.assertEqual(self.check(rest, rest[:2]+[(.6, 0, .8)])['status'], 'pass')

    def test_winged_belly_fails_even_with_normalized_skin(self):
        self.assertEqual(self.check([(-.2, 0, .5), (.2, 0, .5)],
                                    [(-.35, 0, .6), (.35, 0, .6)])['status'], 'fail')

    def test_region_translation_detected_when_width_unchanged(self):
        self.assertEqual(self.check([(-.2, 0, .5), (.2, 0, .5)],
                                    [(-.2, .1, .5), (.2, .1, .5)])['status'], 'fail')

    def test_missing_or_nonfinite_evidence_rejected(self):
        for rest, posed, indices in [([], [], []), ([(0,0,0)], [], [0]),
                                    ([(0,0,0)], [(0,0,0)], []),
                                    ([(0,0,0)], [(float('nan'),0,0)], [0])]:
            with self.assertRaises(ValueError): self.check(rest, posed, indices)


if __name__ == '__main__':
    unittest.main()
