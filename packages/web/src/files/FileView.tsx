import { useParams, useSearchParams } from 'react-router'

import { api } from '../api'
import { FileFrame } from './FileFrame'
import { FolderView } from './FolderView'
import { TextOrCard } from './TextOrCard'

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i

const PDF = /\.pdf$/i

const MEDIA = /\.(mp4|webm|mov|mp3|wav|ogg)$/i

export function FileView() {
  const { ws = '', '*': splat = '' } = useParams()
  const [search] = useSearchParams()
  const path = decodeURIComponent(splat)
  if (!path) return <FolderView ws={ws} dir={search.get('dir') ?? ''} />
  const raw = api.rawUrl(ws, path)
  if (IMAGE.test(path))
    return (
      <FileFrame ws={ws} path={path}>
        <img src={raw} alt={path} className="preview-media" />
      </FileFrame>
    )
  if (PDF.test(path))
    return (
      <FileFrame ws={ws} path={path} fill>
        <iframe src={raw} title={path} sandbox="allow-same-origin" className="preview-frame" />
      </FileFrame>
    )
  if (MEDIA.test(path))
    return (
      <FileFrame ws={ws} path={path}>
        {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- preview only */}
        <video src={raw} controls className="preview-media" />
      </FileFrame>
    )
  return <TextOrCard key={`${ws}:${path}`} ws={ws} path={path} />
}
