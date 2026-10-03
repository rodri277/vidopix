import { useEditorState } from '../../state/editor-context';

const TOOL_LABELS = {
  pencil: 'Pencil',
  eraser: 'Eraser',
  fill: 'Fill',
  eyedropper: 'Eyedropper',
  line: 'Line',
  rectangle: 'Rectangle',
  ellipse: 'Ellipse',
  select: 'Select',
  move: 'Move',
} as const;

export function StatusBar() {
  const cursor = useEditorState((state) => state.cursor);
  const keyboardCursor = useEditorState((state) => state.keyboardCursor);
  const width = useEditorState((state) => state.spriteWidth);
  const height = useEditorState((state) => state.spriteHeight);
  const zoom = useEditorState((state) => state.viewport.zoom);
  const tool = useEditorState((state) => state.tool);
  const selection = useEditorState((state) => state.selection);
  const notice = useEditorState((state) => state.notice);
  const position = keyboardCursor ?? cursor;

  return (
    <>
      <span>
        {position && position.x >= 0 && position.y >= 0 && position.x < width && position.y < height
          ? `${String(position.x)}, ${String(position.y)}`
          : '—'}
      </span>
      <span>
        {String(width)}×{String(height)} px
      </span>
      <span>{String(zoom * 100)}%</span>
      <span>{TOOL_LABELS[tool]}</span>
      <span>
        {selection ? `Selection ${String(selection.width)}×${String(selection.height)}` : ''}
      </span>
      <span>{notice === '' ? 'Not saved' : notice}</span>
      <span>by vidotho</span>
    </>
  );
}
