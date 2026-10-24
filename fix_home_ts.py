#!/usr/bin/env python3
import re

file_path = r'c:\Users\tusha\OneDrive\Desktop\HOSTEL MANAGEMENT SYSTEM\hostel-management-system\src\pages\Home.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add ImageItem import after the lucide-react import block
# Find the position after "}" from "lucide-react"; import
import_pattern = r'(\} from "lucide-react";)'
match = re.search(import_pattern, content)
if match:
    pos = match.end()
    # Insert ImageItem import after the lucide-imports block
    content = content[:pos] + '\nimport type { ImageItem } from "./CampusGallery";\n' + content[pos:]
    print(f'Fix 1: Added ImageItem import at position {pos}')

# Fix 2: Change FeatureCard function signature - JSX.Element to any
old_fc = 'function FeatureCard({ icon, title, description }: { icon: any; title: string; description: string }) {'
# Check if it's still JSX.Element (means our earlier edit didn't stick)
old_fc_jsx = 'function FeatureCard({ icon, title, description }: { icon: JSX.Element; title: string; description: string }) {'
if old_fc_jsx in content:
    content = content.replace(old_fc_jsx, old_fc)
    print('Fix 2a: Changed FeatureCard from JSX.Element to any')
elif old_fc not in content:
    # Try finding and changing the actual FeatureCard function
    fc_match = re.search(r'function FeatureCard\([^}]+\) \{\s*', content)
    if fc_match:
        print('Fix 2b: Found FeatureCard function, will fix')
        
# Fix 3: Change WhyItem function signature  
old_wi_jsx = 'function WhyItem({ icon, title, description }: { icon: JSX.Element; title: string; description: string }) {'
if old_wi_jsx in content:
    content = content.replace(old_wi_jsx, old_fc.replace('FeatureCard', 'WhyItem'))
    print('Fix 3: Changed WhyItem from JSX.Element to any')

# Fix 4: Ensure Star2 is in the import (check and add if missing)
if 'Star2' not in content:
    # Add Star2 to the lucide-react import
    star2_pattern = r'(\} from "lucide-react";)'
    if re.search(star2_pattern, content):
        content = re.sub(star2_pattern, '   Star2,\n\\1', content)
        print('Fix 4: Added Star2 to lucide-react imports')

# Fix 5: Ensure ImageItem type is used correctly in GalleryItem
# The GalleryItem function expects { item: ImageItem } - verify it's correct
if 'function GalleryItem({ item }: { item: ImageItem })' in content:
    print('Fix 5: GalleryItem type is correctly defined as { item: ImageItem }')

# Write the fixed content
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Home.tsx fixes applied')