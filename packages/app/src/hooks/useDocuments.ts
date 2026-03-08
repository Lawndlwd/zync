import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
} from '@/services/documents'

export function useFolders(parent?: string) {
  return useQuery({
    queryKey: ['doc-folders', parent],
    queryFn: () => fetchFolders(parent),
  })
}

export function useDocuments(folder?: string) {
  return useQuery({
    queryKey: ['documents', folder],
    queryFn: () => fetchDocuments(folder),
  })
}

export function useCreateFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createFolder(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doc-folders'] }),
  })
}

export function useRenameFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) => renameFolder(oldName, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-folders'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useDeleteFolder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => deleteFolder(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-folders'] })
      qc.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

export function useCreateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { folder: string; title: string; content?: string }) => createDocument(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['doc-folders'] })
    },
  })
}

export function useUpdateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ path, ...updates }: { path: string; title?: string; content?: string; folder?: string }) =>
      updateDocument(path, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['doc-folders'] })
    },
  })
}

export function useDeleteDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => deleteDocument(path),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents'] })
      qc.invalidateQueries({ queryKey: ['doc-folders'] })
    },
  })
}
