import type { Profile, CvTheme } from '@/types/jobs'

interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

export function CompactAtsTemplate({ profile, theme }: TemplateProps) {
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
        .cv-ats {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 8mm 10mm;
          background: var(--cv-bg);
          font-family: var(--cv-font-body);
          font-size: var(--cv-font-size);
          line-height: var(--cv-line-height);
          color: var(--cv-primary);
        }
        .cv-ats .ats-name {
          font-family: var(--cv-font-heading);
          font-size: 22pt;
          font-weight: 700;
          text-align: center;
          margin: 0;
          color: var(--cv-primary);
        }
        .cv-ats .ats-contact {
          text-align: center;
          font-size: 8.5pt;
          color: var(--cv-secondary);
          margin: 4px 0 8px;
        }
        .cv-ats .ats-divider {
          border: none;
          border-top: 1px solid var(--cv-primary);
          margin: 0 0 8px;
        }
        .cv-ats .ats-section {
          margin-bottom: calc(var(--cv-section-spacing) * 0.75);
        }
        .cv-ats .ats-section-title {
          font-family: var(--cv-font-heading);
          font-size: 10pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--cv-primary);
          margin: 0;
          padding-bottom: 2px;
          border-bottom: 1px solid var(--cv-primary);
          margin-bottom: 6px;
        }
        .cv-ats .ats-entry {
          margin-bottom: 8px;
        }
        .cv-ats .ats-entry:last-child {
          margin-bottom: 0;
        }
        .cv-ats .ats-entry-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          flex-wrap: nowrap;
        }
        .cv-ats .ats-entry-left {
          flex: 1;
          min-width: 0;
        }
        .cv-ats .ats-entry-title {
          font-weight: 700;
          color: var(--cv-primary);
        }
        .cv-ats .ats-entry-detail {
          color: var(--cv-primary);
        }
        .cv-ats .ats-entry-dates {
          font-size: 9pt;
          color: var(--cv-secondary);
          white-space: nowrap;
          margin-left: 8px;
          flex-shrink: 0;
        }
        .cv-ats .ats-bullets {
          margin: 2px 0 0 16px;
          padding: 0;
          list-style-type: disc;
        }
        .cv-ats .ats-bullets li {
          margin-bottom: 1px;
        }
        .cv-ats .ats-summary {
          color: var(--cv-primary);
          font-size: 9.5pt;
          margin: 0;
        }
        .cv-ats .ats-skills-row {
          margin-bottom: 2px;
        }
        .cv-ats .ats-skills-label {
          font-weight: 700;
        }
        .cv-ats .ats-proj-inline {
          margin-bottom: 4px;
        }
        .cv-ats .ats-proj-inline:last-child {
          margin-bottom: 0;
        }
        .cv-ats .ats-proj-title {
          font-weight: 700;
        }
        .cv-ats .ats-proj-tech {
          color: var(--cv-secondary);
          font-size: 9pt;
        }
        .cv-ats [data-field] {
          cursor: text;
          transition: outline 0.15s;
          border-radius: 1px;
        }
        .cv-ats [data-field]:hover {
          outline: 1px dashed color-mix(in srgb, var(--cv-accent) 50%, transparent);
          outline-offset: 2px;
        }
      `}} />
      <div className="cv-ats" style={cssVars}>
        <h1 className="ats-name" data-field="name">{profile.name}</h1>
        <div className="ats-contact">{contactItems.join(' | ')}</div>
        <hr className="ats-divider" />

        {profile.summary && (
          <div className="ats-section">
            <h2 className="ats-section-title">Summary</h2>
            <p className="ats-summary" data-field="summary">{profile.summary}</p>
          </div>
        )}

        {profile.experiences.length > 0 && (
          <div className="ats-section">
            <h2 className="ats-section-title">Experience</h2>
            {profile.experiences.map((exp, i) => (
              <div key={exp.id} className="ats-entry">
                <div className="ats-entry-header">
                  <div className="ats-entry-left">
                    <span className="ats-entry-title" data-field={`experiences.${i}.title`}>{exp.title}</span>
                    <span className="ats-entry-detail"> &mdash; <span data-field={`experiences.${i}.company`}>{exp.company}</span>{exp.location ? <>, <span data-field={`experiences.${i}.location`}>{exp.location}</span></> : ''}</span>
                  </div>
                  <span className="ats-entry-dates">{exp.startDate} &ndash; {exp.endDate || 'Present'}</span>
                </div>
                {exp.bullets.length > 0 && (
                  <ul className="ats-bullets">
                    {exp.bullets.map((b, j) => <li key={j} data-field={`experiences.${i}.bullets.${j}`}>{b}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {profile.educations.length > 0 && (
          <div className="ats-section">
            <h2 className="ats-section-title">Education</h2>
            {profile.educations.map((edu, i) => (
              <div key={edu.id} className="ats-entry">
                <div className="ats-entry-header">
                  <div className="ats-entry-left">
                    <span className="ats-entry-title"><span data-field={`educations.${i}.degree`}>{edu.degree}</span>{edu.field ? <>, <span data-field={`educations.${i}.field`}>{edu.field}</span></> : ''}</span>
                    <span className="ats-entry-detail" data-field={`educations.${i}.school`}> &mdash; {edu.school}</span>
                    {edu.gpa && <span className="ats-entry-detail"> (GPA: {edu.gpa})</span>}
                  </div>
                  <span className="ats-entry-dates">{edu.startDate} &ndash; {edu.endDate || 'Present'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {(profile.skills.length > 0 || profile.languages.length > 0) && (
          <div className="ats-section">
            <h2 className="ats-section-title">Skills</h2>
            {profile.skills.length > 0 && (
              <div className="ats-skills-row">
                <span className="ats-skills-label">Technical Skills: </span>
                <span>{profile.skills.join(', ')}</span>
              </div>
            )}
            {profile.languages.length > 0 && (
              <div className="ats-skills-row">
                <span className="ats-skills-label">Languages: </span>
                <span>{profile.languages.join(', ')}</span>
              </div>
            )}
          </div>
        )}

        {profile.projects.length > 0 && (
          <div className="ats-section">
            <h2 className="ats-section-title">Projects</h2>
            {profile.projects.map((proj, i) => (
              <div key={proj.id} className="ats-proj-inline">
                <span className="ats-proj-title" data-field={`projects.${i}.name`}>{proj.name}</span>
                {proj.technologies.length > 0 && (
                  <span className="ats-proj-tech"> ({proj.technologies.join(', ')})</span>
                )}
                <span data-field={`projects.${i}.description`}> &mdash; {proj.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
