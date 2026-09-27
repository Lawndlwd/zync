export function Loading() {
  return (
    <div className="page col g16" aria-busy="true">
      <div className="skel" style={{ height: 40, width: '40%' }} />
      <div className="skel" style={{ height: 16 }} />
      <div className="skel" style={{ height: 16, width: '70%' }} />
    </div>
  )
}
