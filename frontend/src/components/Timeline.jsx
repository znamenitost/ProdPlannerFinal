export default function Timeline({ segments }) {
  return (
    <div className="timeline-container">
      {segments.map((segment, idx) => (
        <div
          key={idx}
          className={`timeline-segment ${segment.type}`}
          style={{
            left: `${getLeft(segment.start)}%`,
            width: `${getWidth(segment.start, segment.end)}%`
          }}
          title={segment.type === 'work' ? `Задача #${segment.taskId}` : 'Простой'}
        />
      ))}
    </div>
  );
}

function getLeft(dateTime) {
  const d = new Date(dateTime);
  const hours = d.getHours() + d.getMinutes() / 60;
  return ((hours - 10) / 9) * 100;
}

function getWidth(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  const duration = (e - s) / (1000 * 60 * 60);
  return (duration / 9) * 100;
}