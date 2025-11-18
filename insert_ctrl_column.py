from pathlib import Path
lines=Path('client/src/components/viewer/EntityPanel.js').read_text(encoding='utf-8').splitlines()
for i,line in enumerate(lines):
    if line.strip()=="</tr>" and any('색' in l for l in lines[i-20:i]):
        insert_pos=i
        break
else:
    raise SystemExit('row not found')
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
    lines.insert(insert_pos, line)
Path('client/src/components/viewer/EntityPanel.js').write_text('\n'.join(lines)+'\n', encoding='utf-8')
