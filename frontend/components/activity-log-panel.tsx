export function ActivityLogPanel({ logs }: { logs: Array<{ id: string; action: string; subjectType: string; createdAt: Date }> }) {
  return (
    <section className="h-56 overflow-auto border-t p-3">
      <h3 className="mb-2 font-semibold">Activity</h3>
      <ul className="space-y-1 text-xs">
        {logs.map((log) => (
          <li key={log.id} className="rounded bg-muted p-2">
            <div>{log.action} · {log.subjectType}</div>
            <div className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
