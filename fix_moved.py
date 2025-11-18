from pathlib import Path
path=Path('client/src/components/viewer/CanvasController.js')
text=path.read_text(encoding='utf-8')
old='    // ���� �Ÿ� �̻� �����̸� �巡�׷� �����Ͽ� Ŭ�� ó�� �ߴ�\n    if (Math.abs(dx) > moveThreshold || Math.abs(dy) > moveThreshold) {\n      moved = true;\n    }\n'
new='    // ���� �Ÿ� �̻� �����̸� �巡�׷� �����Ͽ� Ŭ�� ó�� �ߴ�\n    if (Math.hypot(dx, dy) > moveThreshold) {\n      moved = true;\n    }\n'
if old not in text:
    raise SystemExit('first block not found')
text=text.replace(old,new,1)
old2='    const wasMoved = moved;\n'
new2='    const dx = event.clientX - downX;\n    const dy = event.clientY - downY;\n    const wasMoved = Math.hypot(dx, dy) > moveThreshold;\n'
if old2 not in text:
    raise SystemExit('second block not found')
text=text.replace(old2,new2,1)
path.write_text(text,encoding='utf-8')
