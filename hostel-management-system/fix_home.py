import re
p=r'c:\Users\tusha\OneDrive\Desktop\HOSTEL MANAGEMENT SYSTEM\hostel-management-system\src\home.css'
s=open(p).read()
s=s.replace('box-shadow: 0 8px 20px rgba(5, 150, 105, 0.32);','box-shadow: 0 8px 20px rgba(23, 37, 59, 0.35);')
s=s.replace('background: rgba(11, 22, 16, 0.86);','background: rgba(11, 18, 32, 0.86);')
s=s.replace('background: rgba(11, 22, 16, 0.96);','background: rgba(11, 18, 32, 0.96);')
s=s.replace('border-bottom-color: rgba(52, 211, 153, 0.12);','border-bottom-color: rgba(201, 169, 110, 0.25);')
s=s.replace('rgba(5, 150, 105','rgba(23, 37, 59')
s=s.replace('rgba(5,150,105','rgba(23,37,59')
open(p,'w').write(s)
print('done')
PY