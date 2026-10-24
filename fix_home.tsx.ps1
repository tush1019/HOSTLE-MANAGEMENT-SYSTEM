#!/usr/bin/env powershell
$file = "c:\\Users\\tusha\\OneDrive\\Desktop\\HOSTEL MANAGEMENT SYSTEM\\hostel-management-system\\src\\pages\\Home.tsx"
$content = Get-Content -Path $file

# Fix 1: Add ImageItem import after the lucide-react import line
for ($i = 0; $i -lt $content.Count; $i++) {
    if ($content[$i] -like "import { Building2" -or $content[$i] -like "import {" -and $content[$i+1] -like "Building2") {
        # Found the import block, insert ImageItem import after it
        $content.Insert($i+1, "import type { ImageItem } from \"../pages/CampusGallery\";")
        break
    }
}

# Fix 2: Change FeatureCard function signature
for ($i = 0; $i -lt $content.Count; $i++) {
    if ($content[$i] -like "function FeatureCard*") {
        $content[$i] = $content[$i].Replace("{ icon: JSX.Element; title: string; description: string }", "{ icon: any; title: string; description: string }")
        break
    }
}

# Fix 3: Change WhyItem function signature
for ($i = 0; $i -lt $content.Count; $i++) {
    if ($content[$i] -like "function WhyItem*") {
        $content[$i] = $content[$i].Replace("{ icon: JSX.Element; title: string; description: string }", "{ icon: any; title: string; description: string }")
        break
    }
}

# Fix 4: Add Star2 to lucide-react imports
for ($i = 0; $i -lt $content.Count; $i++) {
    if ($content[$i] -eq "} from \"lucide-react\";") {
        $content[$i-1] = $content[$i-1].Trim() + ", Star2"
        $content[$i] = "} from \"lucide-react\";"
        break
    }
}

Set-Content -Path $file -Value $content
Write-Host "Fixes applied"