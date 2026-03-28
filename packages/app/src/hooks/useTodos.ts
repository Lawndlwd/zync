import { useQuery } from '@tanstack/react-query'
import { fetchTodos } from '@/services/todos'

export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: fetchTodos,
  })
}
