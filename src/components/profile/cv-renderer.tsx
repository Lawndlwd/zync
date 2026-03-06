import type { Profile, CvTheme } from '@/types/jobs'
import './cv-styles.css'

interface CvRendererProps {
  profile: Profile
  theme: CvTheme
}

export function CvRenderer({ profile, theme }: CvRendererProps) {
  const cssVars = {
    '--cv-primary': theme.primaryColor,
    '--cv-secondary': theme.secondaryColor,
    '--cv-accent': theme.accentColor,
    '--cv-bg': theme.backgroundColor,
    '--cv-font-heading': theme.fontHeading,
    '--cv-font-body': theme.fontBody,
    '--cv-font-size': `${theme.fontSize}pt`,
    '--cv-line-height': theme.lineHeight,
    '--cv-section-spacing': `${theme.sectionSpacing}rem`,
  } as React.CSSProperties

  const contactItems = [
    profile.email,
    profile.phone,
    profile.location,
    profile.linkedin,
    profile.website,
  ].filter(Boolean)

  return (
    <div
      className="cv-document"
      style={cssVars}
      data-layout={theme.layout}
      data-header={theme.headerStyle}
    >
      {/* HEADER */}
      <header className="cv-header">
        <div className="cv-header-text">
          <h1 className="cv-name">{profile.name}</h1>
          {profile.title && <p className="cv-title">{profile.title}</p>}
        </div>
        {contactItems.length > 0 && (
          <div className="cv-contact">
            {contactItems.map((item, i) => (
              <span key={i} className="cv-contact-item">
                {item}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="cv-body">
        <div className="cv-main">
          {/* SUMMARY */}
          {profile.summary && (
            <section className="cv-section">
              <h2 className="cv-section-title">Summary</h2>
              <p className="cv-text">{profile.summary}</p>
            </section>
          )}

          {/* EXPERIENCE */}
          {profile.experiences?.length > 0 && (
            <section className="cv-section">
              <h2 className="cv-section-title">Experience</h2>
              {profile.experiences.map((exp) => (
                <div key={exp.id} className="cv-entry">
                  <div className="cv-entry-header">
                    <div className="cv-entry-left">
                      <strong className="cv-entry-title">{exp.title}</strong>
                      <span className="cv-entry-separator"> | </span>
                      <span className="cv-entry-org">{exp.company}</span>
                      {exp.location && (
                        <>
                          <span className="cv-entry-separator"> | </span>
                          <span className="cv-entry-location">{exp.location}</span>
                        </>
                      )}
                    </div>
                    <span className="cv-entry-dates">
                      {exp.startDate} &mdash; {exp.endDate || 'Present'}
                    </span>
                  </div>
                  {exp.bullets.length > 0 && (
                    <ul className="cv-bullets">
                      {exp.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}

          {/* EDUCATION */}
          {profile.educations?.length > 0 && (
            <section className="cv-section">
              <h2 className="cv-section-title">Education</h2>
              {profile.educations.map((edu) => (
                <div key={edu.id} className="cv-entry">
                  <div className="cv-entry-header">
                    <div className="cv-entry-left">
                      <strong className="cv-entry-title">
                        {edu.degree}
                        {edu.field ? ` in ${edu.field}` : ''}
                      </strong>
                      <span className="cv-entry-separator"> | </span>
                      <span className="cv-entry-org">{edu.school}</span>
                    </div>
                    <span className="cv-entry-dates">
                      {edu.startDate} &mdash; {edu.endDate || 'Present'}
                    </span>
                  </div>
                  {edu.gpa && <p className="cv-text cv-gpa">GPA: {edu.gpa}</p>}
                </div>
              ))}
            </section>
          )}

          {/* PROJECTS */}
          {profile.projects?.length > 0 && (
            <section className="cv-section">
              <h2 className="cv-section-title">Projects</h2>
              {profile.projects.map((proj) => (
                <div key={proj.id} className="cv-entry">
                  <div className="cv-entry-header">
                    <strong className="cv-entry-title">{proj.name}</strong>
                    {proj.url && (
                      <a className="cv-link" href={proj.url} target="_blank" rel="noreferrer">
                        {proj.url}
                      </a>
                    )}
                  </div>
                  <p className="cv-text">{proj.description}</p>
                  {proj.technologies.length > 0 && (
                    <p className="cv-tech">{proj.technologies.join(' \u00B7 ')}</p>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>

        {/* ASIDE: skills + languages */}
        <div className="cv-aside">
          {profile.skills?.length > 0 && (
            <section className="cv-section">
              <h2 className="cv-section-title">Skills</h2>
              <div className="cv-tags">
                {profile.skills.map((s) => (
                  <span key={s} className="cv-tag">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {profile.languages?.length > 0 && (
            <section className="cv-section">
              <h2 className="cv-section-title">Languages</h2>
              <div className="cv-tags">
                {profile.languages.map((l) => (
                  <span key={l} className="cv-tag">
                    {l}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
