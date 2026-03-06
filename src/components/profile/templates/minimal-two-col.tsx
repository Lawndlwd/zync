import type { Profile, CvTheme } from '@/types/jobs'

interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

export function MinimalTwoColTemplate({ profile, theme }: TemplateProps) {
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
        .cv-min2col {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 20mm 22mm;
          background: var(--cv-bg);
          font-family: var(--cv-font-body);
          font-size: var(--cv-font-size);
          line-height: var(--cv-line-height);
          color: var(--cv-primary);
        }
        .cv-min2col .m2c-name {
          font-family: var(--cv-font-heading);
          font-size: 28pt;
          font-weight: 700;
          color: var(--cv-accent);
          margin: 0 0 4px;
          letter-spacing: -0.5px;
        }
        .cv-min2col .m2c-meta {
          font-size: 9pt;
          color: var(--cv-secondary);
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-min2col .m2c-row {
          display: grid;
          grid-template-columns: 130px 1fr;
          gap: 0 24px;
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-min2col .m2c-label {
          font-family: var(--cv-font-heading);
          font-size: 8pt;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--cv-secondary);
          padding-top: 2px;
        }
        .cv-min2col .m2c-content {
          color: var(--cv-primary);
        }
        .cv-min2col .m2c-entry {
          margin-bottom: 12px;
        }
        .cv-min2col .m2c-entry:last-child {
          margin-bottom: 0;
        }
        .cv-min2col .m2c-entry-title {
          font-weight: 700;
          color: var(--cv-primary);
        }
        .cv-min2col .m2c-entry-company {
          color: var(--cv-secondary);
        }
        .cv-min2col .m2c-entry-row {
          display: grid;
          grid-template-columns: 130px 1fr;
          gap: 0 24px;
          margin-bottom: 12px;
        }
        .cv-min2col .m2c-date {
          font-size: 8pt;
          color: var(--cv-secondary);
          padding-top: 2px;
          text-align: right;
          padding-right: 0;
        }
        .cv-min2col .m2c-bullets {
          margin: 4px 0 0 16px;
          padding: 0;
        }
        .cv-min2col .m2c-bullets li {
          margin-bottom: 2px;
          font-size: calc(var(--cv-font-size) * 0.95);
        }
        .cv-min2col .m2c-summary {
          color: var(--cv-secondary);
          font-size: 10pt;
        }
        .cv-min2col .m2c-skills-text {
          color: var(--cv-primary);
        }
        .cv-min2col .m2c-proj-desc {
          color: var(--cv-secondary);
          margin-top: 2px;
          font-size: 9.5pt;
        }
        .cv-min2col .m2c-proj-tech {
          color: var(--cv-accent);
          font-size: 8.5pt;
          margin-top: 2px;
        }
      `}} />
      <div className="cv-min2col" style={cssVars}>
        <div className="m2c-name">{profile.name}</div>
        <div className="m2c-meta">
          {profile.title}{contactItems.length > 0 && <> &nbsp;&middot;&nbsp; {contactItems.join(' &middot; ')}</>}
        </div>

        {profile.summary && (
          <div className="m2c-row">
            <div className="m2c-label">About</div>
            <div className="m2c-content m2c-summary">{profile.summary}</div>
          </div>
        )}

        {profile.experiences.length > 0 && (
          <div style={{ marginBottom: 'var(--cv-section-spacing)' }}>
            {profile.experiences.map((exp, idx) => (
              <div key={exp.id} className="m2c-entry-row">
                <div className="m2c-date">
                  {idx === 0 && <div className="m2c-label" style={{ textAlign: 'left', marginBottom: 8 }}>Experience</div>}
                  {exp.startDate} &ndash; {exp.endDate || 'Present'}
                </div>
                <div className="m2c-content">
                  <span className="m2c-entry-title">{exp.title}</span>
                  <span className="m2c-entry-company"> &mdash; {exp.company}</span>
                  {exp.location && <span className="m2c-entry-company">, {exp.location}</span>}
                  {exp.bullets.length > 0 && (
                    <ul className="m2c-bullets">
                      {exp.bullets.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {profile.educations.length > 0 && (
          <div style={{ marginBottom: 'var(--cv-section-spacing)' }}>
            {profile.educations.map((edu, idx) => (
              <div key={edu.id} className="m2c-entry-row">
                <div className="m2c-date">
                  {idx === 0 && <div className="m2c-label" style={{ textAlign: 'left', marginBottom: 8 }}>Education</div>}
                  {edu.startDate} &ndash; {edu.endDate || 'Present'}
                </div>
                <div className="m2c-content">
                  <span className="m2c-entry-title">{edu.degree}{edu.field ? `, ${edu.field}` : ''}</span>
                  <span className="m2c-entry-company"> &mdash; {edu.school}</span>
                  {edu.gpa && <div style={{ fontSize: '9pt', color: 'var(--cv-secondary)', marginTop: 2 }}>GPA: {edu.gpa}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {profile.skills.length > 0 && (
          <div className="m2c-row">
            <div className="m2c-label">Skills</div>
            <div className="m2c-content m2c-skills-text">{profile.skills.join(', ')}</div>
          </div>
        )}

        {profile.projects.length > 0 && (
          <div className="m2c-row">
            <div className="m2c-label">Projects</div>
            <div className="m2c-content">
              {profile.projects.map((proj) => (
                <div key={proj.id} className="m2c-entry">
                  <span className="m2c-entry-title">{proj.name}</span>
                  {proj.url && <span style={{ fontSize: '8pt', color: 'var(--cv-secondary)', marginLeft: 6 }}>{proj.url}</span>}
                  <div className="m2c-proj-desc">{proj.description}</div>
                  {proj.technologies.length > 0 && (
                    <div className="m2c-proj-tech">{proj.technologies.join(', ')}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.languages.length > 0 && (
          <div className="m2c-row">
            <div className="m2c-label">Languages</div>
            <div className="m2c-content m2c-skills-text">{profile.languages.join(', ')}</div>
          </div>
        )}
      </div>
    </>
  )
}
