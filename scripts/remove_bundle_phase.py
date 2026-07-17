#!/usr/bin/env python3
"""Remove Bundle React Native code and images build phase from Xcode project."""
import re
import sys

def main():
    proj_file = "ios/AIBrainIM.xcodeproj/project.pbxproj"
    try:
        with open(proj_file, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"ERROR: File not found: {proj_file}")
        sys.exit(1)

    # Find bundle phase UUID from buildPhases reference
    # Pattern: UUID /* Bundle React Native code and images */,
    bundle_ref = re.compile(
        r'([0-9A-F]{24})\s*/\*\s*Bundle React Native code and images\s*\*/\s*,'
    )
    matches = list(bundle_ref.finditer(content))
    
    if not matches:
        print("Bundle phase reference not found in buildPhases")
        sys.exit(0)  # Not an error - phase might already be removed
    
    bundle_uuid = matches[0].group(1)
    print(f"Found bundle phase UUID: {bundle_uuid}")

    # Remove from buildPhases array
    content = bundle_ref.sub('', content)

    # Remove the build phase object definition
    # The object starts with the UUID comment line and ends with };
    phase_obj = re.compile(
        bundle_uuid + r'\s*/\*\s*Bundle React Native code and images\s*\*/\s*=\s*\{[^}]+\};',
        re.DOTALL
    )
    new_content = phase_obj.sub('', content)
    
    if new_content == content:
        print("WARNING: Phase object pattern did not match anything")
    
    with open(proj_file, "w", encoding="utf-8") as f:
        f.write(new_content)
    
    print("Bundle phase removed successfully")

if __name__ == "__main__":
    main()
