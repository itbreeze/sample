from pathlib import Path
lines=Path('client/src/components/viewer/EntityPanel.js').read_text(encoding='utf-8').splitlines()
marker='<th'
for i,line in enumerate(lines):
    if '색' in line and 'textAlign' in lines[i-5]:
        insert_pos=i+1
        break
else:
    raise SystemExit('marker not found')
insert_lines=[
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
for ln in reversed(insert_lines):
    lines.insert(insert_pos, ln)
Path('client/src/components/viewer/EntityPanel.js').write_text('\n'.join(lines)+'\n', encoding='utf-8')
