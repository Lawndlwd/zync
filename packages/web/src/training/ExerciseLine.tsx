import type { Exercise } from '../types/training'

/** An exercise in a list: its picture, name, muscle group and equipment. */
export function ExerciseLine({ exercise }: { exercise: Exercise }) {
  const picture = exercise.image ?? exercise.gif
  return (
    <>
      {picture ? (
        <img className="tr-thumb" src={picture} alt="" loading="lazy" />
      ) : (
        <span className="tr-thumb" aria-hidden="true" />
      )}
      <span className="grow col g4" style={{ minWidth: 0, textAlign: 'left' }}>
        <span className="trunc">{exercise.name}</span>
        <span className="mono-s muted trunc">
          {exercise.muscleGroup} · {exercise.equipment}
          {exercise.target ? ` · ${exercise.target}` : ''}
        </span>
      </span>
      {exercise.custom && <span className="label alt">custom</span>}
    </>
  )
}
