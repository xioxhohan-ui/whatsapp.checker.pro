import sys
import os

# Append the backend root directory (3 levels up from this file) to sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.append(backend_dir)

from app.utils.normalization import normalize_bd_number


def run_tests():
    # Test cases: (input_string, expected_output)
    test_cases = [
        # Standard local representation
        ("01819985042", "8801819985042"),
        # Standard international representation
        ("8801717840013", "8801717840013"),
        # Plus prefixed international representation
        ("+8801911320091", "8801911320091"),
        # Spaces, symbols, and formatting noise
        ("01819-985042", "8801819985042"),
        ("+880 1717-840 013", "8801717840013"),
        ("  01911320091  ", "8801911320091"),
        # 10 digit local format (omits leading zero)
        ("1819985042", "8801819985042"),
        
        # Invalid cases (should return None)
        ("01234567890", None),       # Invalid carrier prefix (012)
        ("12345", None),             # Short length
        ("880171784001", None),      # Wrong digit length (12)
        ("abcdefghijk", None),       # Non numeric input
        ("", None),                  # Empty input
        (None, None),                # Null input
    ]

    failed = 0
    print("Executing Bangladesh Normalization Unit Tests...")
    print("-" * 50)
    for idx, (inp, expected) in enumerate(test_cases):
        res = normalize_bd_number(inp)
        if res == expected:
            print(f"Test {idx + 1}: PASSED - Input: '{inp}' -> Output: '{res}'")
        else:
            print(f"Test {idx + 1}: FAILED - Input: '{inp}' -> Expected: '{expected}', Got: '{res}'")
            failed += 1
            
    print("-" * 50)
    if failed == 0:
        print("ALL TESTS PASSED SUCCESSFULLY!")
        return True
    else:
        print(f"{failed} TESTS FAILED.")
        return False


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
