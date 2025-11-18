from pathlib import Path
lines=Path('client/src/components/viewer/EntityPanel.js').read_text(encoding='utf-8').splitlines()
idx=None
for i,line in enumerate(lines):
    if '색' in line and '<th' in lines[i-1]:
        idx=i
        break
if idx is None:
    raise SystemExit('not found header')
insert=[
"                        <th",
"                          style={{",
"                            padding: '6px 8px',",
"                            textAlign: 'center',",
"                            width: 80,",
"                            fontWeight: 600,",
"                            color: '#475569',",
"                          }}",
"                        >",
"                          조작",
"                        </th>"
]
for line in reversed(insert):
    lines.insert(idx, line)
Path('client/src/components/viewer/EntityPanel.js').write_text('\n'.join(lines)+'\n', encoding='utf-8')
