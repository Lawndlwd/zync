import { PathBar } from './PathBar'

export function PageSkeleton({ ws, path }: { ws: string; path: string }) {
  return (
    <div className="fileview">
      <PathBar ws={ws} path={path} />
      <div className="page file-page">
        <div className="doc col g16">
          <div className="skel" style={{ height: 40, width: '60%' }} />
          <div className="skel" style={{ height: 16 }} />
          <div className="skel" style={{ height: 16, width: '80%' }} />
        </div>
      </div>
    </div>
  )
}
