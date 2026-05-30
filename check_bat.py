import re

with open('F:/27522/OneDrive/Downloads/oopz-obs-speaking-overlay_V0.2/configure.bat', 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.split('\n')
for i, line in enumerate(lines):
    if line.startswith('echo '):
        rest = line[5:]
        temp = rest
        temp = re.sub(r'"[^"]*"', '', temp)
        temp = re.sub(r"'[^']*'", '', temp)
        if any(c in temp for c in ['&', '|', '<', '>', '(', ')']):
            print(f'Line {i+1}: {repr(line)}')
