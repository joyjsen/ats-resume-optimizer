
import re

file_path = '/Users/joyjsen/Documents/Project_RiResume_Antigravity/src/services/localization/localizationService.ts'

with open(file_path, 'r') as f:
    content = f.read()

# Find the COUNTRIES array
match = re.search(r'export const COUNTRIES: CountryData\[\] = \[(.*?)\];', content, re.DOTALL)
if not match:
    # Try alternate format
    match = re.search(r'export const COUNTRIES = \[(.*?)\];', content, re.DOTALL)

if match:
    countries_text = match.group(1)
    # Find all "name": "..." values
    names = re.findall(r'"name":\s*"([^"]+)"', countries_text)
    
    seen = {}
    duplicates = []
    for name in names:
        if name in seen:
            duplicates.append(name)
        seen[name] = True
    
    if duplicates:
        print(f"Duplicate names found: {duplicates}")
    else:
        print("No duplicate names found.")
        
    # Find all "code": "..." values
    codes = re.findall(r'"code":\s*"([^"]+)"', countries_text)
    seen_codes = {}
    duplicate_codes = []
    for code in codes:
        if code != '??': # We know ?? is duplicate
            if code in seen_codes:
                duplicate_codes.append(code)
            seen_codes[code] = True
            
    if duplicate_codes:
        print(f"Duplicate codes found (excluding ??): {duplicate_codes}")
else:
    print("Could not find COUNTRIES array.")
