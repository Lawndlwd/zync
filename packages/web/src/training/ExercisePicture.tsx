import { useExercise } from '../hooks/useExercise'

/** How an exercise is done, by its id: the demonstration, else the still, else an empty frame. */
export function ExercisePicture({ ws, id, name }: { ws: string; id: string; name: string }) {
  const exercise = useExercise(ws, id).data?.exercise
  const picture = exercise?.gif ?? exercise?.image
  return picture ? (
    <img className="tr-demo" src={picture} alt={`${name}, demonstrated`} loading="lazy" />
  ) : (
    <span className="tr-demo" aria-hidden="true" />
  )
}
