import type { Profile, CvTheme } from '@/types/jobs'

interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

export function ClassicTemplate({ profile, theme }: TemplateProps) {
  const cssVars = {
    '--cv-primary': theme.primaryColor,
    '--cv-secondary': theme.secondaryColor,
    '--cv-accent': theme.accentColor,
    '--cv-bg': theme.backgroundColor,
    '--cv-font-heading': theme.fontHeading,
    '--cv-font-body': theme.fontBody,
    '--cv-font-size': `${theme.fontSize}pt`,
    '--cv-line-height': String(theme.lineHeight),
    '--cv-section-spacing': `${theme.sectionSpacing}rem`,
  } as React.CSSProperties

  const contactItems = [profile.email, profile.phone, profile.location, profile.linkedin, profile.website].filter(Boolean)

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .cv-classic {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 20mm 25mm;
          background: var(--cv-bg);
          font-family: var(--cv-font-body);
          font-size: var(--cv-font-size);
          line-height: var(--cv-line-height);
          color: var(--cv-primary);
        }
        .cv-classic .classic-header {
          text-align: center;
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-classic .classic-name {
          font-family: var(--cv-font-heading);
          font-size: 26pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 3px;
          color: var(--cv-primary);
          margin: 0;
        }
        .cv-classic .classic-title {
          font-family: var(--cv-font-body);
          font-size: 12pt;
          color: var(--cv-secondary);
          margin: 4px 0 10px;
        }
        .cv-classic .classic-contact {
          font-size: 9pt;
          color: var(--cv-secondary);
        }
        .cv-classic .classic-hr {
          border: none;
          border-top: 2px solid var(--cv-accent);
          margin: 12px 0 var(--cv-section-spacing);
        }
        .cv-classic .classic-section {
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-classic .classic-section-title {
          font-family: var(--cv-font-heading);
          font-size: 10pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--cv-accent);
          margin: 0 0 4px;
        }
        .cv-classic .classic-section-line {
          border: none;
          border-top: 1px solid var(--cv-accent);
          margin: 0 0 10px;
          opacity: 0.4;
        }
        .cv-classic .classic-entry {
          margin-bottom: 12px;
        }
        .cv-classic .classic-entry-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .cv-classic .classic-entry-title {
          font-weight: 700;
          color: var(--cv-primary);
        }
        .cv-classic .classic-entry-company {
          font-style: italic;
          color: var(--cv-secondary);
        }
        .cv-classic .classic-entry-dates {
          font-size: 9pt;
          color: var(--cv-secondary);
          white-space: nowrap;
          margin-left: 12px;
        }
        .cv-classic .classic-bullets {
          margin: 4px 0 0 18px;
          padding: 0;
        }
        .cv-classic .classic-bullets li {
          margin-bottom: 2px;
        }
        .cv-classic .classic-summary {
          margin-bottom: var(--cv-section-spacing);
          color: var(--cv-secondary);
          font-size: 10pt;
        }
        .cv-classic .classic-skills-line {
          color: var(--cv-primary);
        }
        .cv-classic [data-field] {
          cursor: text;
          transition: outline 0.15s;
          border-radius: 1px;
        }
        .cv-classic [data-field]:hover {
          outline: 1px dashed rgba(108, 92, 231, 0.4);
          outline-offset: 2px;
        }
      `}} />
      <div className="cv-classic" style={cssVars}>
        <div className="classic-header">
          <h1 className="classic-name" data-field="name">{profile.name}</h1>
          <div className="classic-title" data-field="title">{profile.title}</div>
          <div className="classic-contact">{contactItems.join(' | ')}</div>
        </div>

        <hr className="classic-hr" />

        {profile.summary && (
          <div className="classic-section">
            <h2 className="classic-section-title">Summary</h2>
            <hr className="classic-section-line" />
            <p className="classic-summary" data-field="summary">{profile.summary}</p>
          </div>
        )}

        {profile.experiences.length > 0 && (
          <div className="classic-section">
            <h2 className="classic-section-title">Experience</h2>
            <hr className="classic-section-line" />
            {profile.experiences.map((exp, i) => (
              <div key={exp.id} className="classic-entry">
                <div className="classic-entry-header">
                  <div>
                    <span className="classic-entry-title" data-field={`experiences.${i}.title`}>{exp.title}</span>
                    <span> &mdash; </span>
                    <span className="classic-entry-company" data-field={`experiences.${i}.company`}>{exp.company}</span>
                  </div>
                  <span className="classic-entry-dates">
                    {exp.startDate} &ndash; {exp.endDate || 'Present'}
                  </span>
                </div>
                {exp.bullets.length > 0 && (
                  <ul className="classic-bullets">
                    {exp.bullets.map((b, j) => <li key={j} data-field={`experiences.${i}.bullets.${j}`}>{b}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {profile.educations.length > 0 && (
          <div className="classic-section">
            <h2 className="classic-section-title">Education</h2>
            <hr className="classic-section-line" />
            {profile.educations.map((edu, i) => (
              <div key={edu.id} className="classic-entry">
                <div className="classic-entry-header">
                  <div>
                    <span className="classic-entry-title" data-field={`educations.${i}.degree`}>{edu.degree}{edu.field ? `, ${edu.field}` : ''}</span>
                    <span> &mdash; </span>
                    <span className="classic-entry-company" data-field={`educations.${i}.school`}>{edu.school}</span>
                  </div>
                  <span className="classic-entry-dates">
                    {edu.startDate} &ndash; {edu.endDate || 'Present'}
                  </span>
                </div>
                {edu.gpa && <div style={{ marginTop: 2, fontSize: '9pt', color: 'var(--cv-secondary)' }}>GPA: {edu.gpa}</div>}
              </div>
            ))}
          </div>
        )}

        {profile.skills.length > 0 && (
          <div className="classic-section">
            <h2 className="classic-section-title">Skills</h2>
            <hr className="classic-section-line" />
            <div className="classic-skills-line">{profile.skills.join(', ')}</div>
          </div>
        )}

        {profile.projects.length > 0 && (
          <div className="classic-section">
            <h2 className="classic-section-title">Projects</h2>
            <hr className="classic-section-line" />
            {profile.projects.map((proj, i) => (
              <div key={proj.id} className="classic-entry">
                <div className="classic-entry-header">
                  <span className="classic-entry-title" data-field={`projects.${i}.name`}>{proj.name}</span>
                </div>
                <div style={{ marginTop: 2, color: 'var(--cv-secondary)' }} data-field={`projects.${i}.description`}>{proj.description}</div>
                {proj.technologies.length > 0 && (
                  <div style={{ marginTop: 2, fontSize: '9pt', color: 'var(--cv-accent)' }}>{proj.technologies.join(', ')}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {profile.languages.length > 0 && (
          <div className="classic-section">
            <h2 className="classic-section-title">Languages</h2>
            <hr className="classic-section-line" />
            <div className="classic-skills-line">{profile.languages.join(', ')}</div>
          </div>
        )}
      </div>
    </>
  )
}
