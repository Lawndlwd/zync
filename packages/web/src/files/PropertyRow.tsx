export function PropertyRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <>
      <span className="k trunc" title={name}>
        {name}
      </span>
      <div className="props-v">{children}</div>
    </>
  )
}
