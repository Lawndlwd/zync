import type { Profile, CvTheme } from '@/types/jobs'

interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

export function ModernLeftTemplate({ profile, theme }: TemplateProps) {
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
  const contactIcons = ['\u2709', '\u260E', '\uD83D\uDCCD', '\uD83D\uDD17', '\uD83D\uDD17']

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .cv-modern-left {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 22mm 24mm;
          background: var(--cv-bg);
          font-family: var(--cv-font-body);
          font-size: var(--cv-font-size);
          line-height: var(--cv-line-height);
          color: var(--cv-primary);
        }
        .cv-modern-left .ml-header {
          margin-bottom: calc(var(--cv-section-spacing) * 1.2);
        }
        .cv-modern-left .ml-name {
          font-family: var(--cv-font-heading);
          font-size: 28pt;
          font-weight: 800;
          color: var(--cv-primary);
          margin: 0;
          line-height: 1.1;
        }
        .cv-modern-left .ml-title {
          font-size: 13pt;
          color: var(--cv-accent);
          margin: 6px 0 10px;
          font-weight: 500;
        }
        .cv-modern-left .ml-contact {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          font-size: 8.5pt;
          color: var(--cv-secondary);
        }
        .cv-modern-left .ml-contact-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .cv-modern-left .ml-section {
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-modern-left .ml-section-title {
          font-family: var(--cv-font-heading);
          font-size: 10pt;
          font-weight: 700;
          color: var(--cv-bg, #fff);
          background: var(--cv-accent);
          display: inline-block;
          padding: 3px 14px;
          border-radius: 3px;
          margin: 0 0 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .cv-modern-left .ml-entry {
          margin-bottom: 14px;
        }
        .cv-modern-left .ml-entry-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }
        .cv-modern-left .ml-company {
          font-weight: 700;
          color: var(--cv-primary);
          font-size: 11pt;
        }
        .cv-modern-left .ml-role {
          color: var(--cv-secondary);
          font-size: 10pt;
        }
        .cv-modern-left .ml-dates {
          font-size: 8.5pt;
          color: var(--cv-secondary);
          white-space: nowrap;
        }
        .cv-modern-left .ml-bullets {
          margin: 4px 0 0 0;
          padding: 0;
          list-style: none;
        }
        .cv-modern-left .ml-bullets li {
          position: relative;
          padding-left: 14px;
          margin-bottom: 3px;
        }
        .cv-modern-left .ml-bullets li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 7px;
          width: 5px;
          height: 5px;
          background: var(--cv-accent);
        }
        .cv-modern-left .ml-summary {
          color: var(--cv-secondary);
          font-size: 10pt;
          margin: 0;
        }
        .cv-modern-left .ml-skills-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .cv-modern-left .ml-skill-pill {
          background: var(--cv-accent);
          color: var(--cv-bg, #fff);
          font-size: 8.5pt;
          padding: 4px 14px;
          border-radius: 2px;
          font-weight: 500;
        }
        .cv-modern-left [data-field] {
          cursor: text;
          transition: outline 0.15s;
          border-radius: 1px;
        }
        .cv-modern-left [data-field]:hover {
          outline: 1px dashed rgba(108, 92, 231, 0.4);
          outline-offset: 2px;
        }
      `}} />
      <div className="cv-modern-left" style={cssVars}>
        <div className="ml-header">
          <h1 className="ml-name" data-field="name">{profile.name}</h1>
          <div className="ml-title" data-field="title">{profile.title}</div>
          <div className="ml-contact">
            {contactItems.map((item, i) => (
              <span key={i} className="ml-contact-item">
                <span>{contactIcons[i]}</span>
                <span>{item}</span>
              </span>
            ))}
          </div>
        </div>

        {profile.summary && (
          <div className="ml-section">
            <h2 className="ml-section-title">Profile</h2>
            <p className="ml-summary" data-field="summary">{profile.summary}</p>
          </div>
        )}

        {profile.experiences.length > 0 && (
          <div className="ml-section">
            <h2 className="ml-section-title">Experience</h2>
            {profile.experiences.map((exp, i) => (
              <div key={exp.id} className="ml-entry">
                <div className="ml-entry-header">
                  <div>
                    <span className="ml-company" data-field={`experiences.${i}.company`}>{exp.company}</span>
                    <span className="ml-role"> &mdash; <span data-field={`experiences.${i}.title`}>{exp.title}</span></span>
                  </div>
                  <span className="ml-dates">{exp.startDate} &ndash; {exp.endDate || 'Present'}</span>
                </div>
                {exp.bullets.length > 0 && (
                  <ul className="ml-bullets">
                    {exp.bullets.map((b, j) => <li key={j} data-field={`experiences.${i}.bullets.${j}`}>{b}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {profile.educations.length > 0 && (
          <div className="ml-section">
            <h2 className="ml-section-title">Education</h2>
            {profile.educations.map((edu, i) => (
              <div key={edu.id} className="ml-entry">
                <div className="ml-entry-header">
                  <div>
                    <span className="ml-company" data-field={`educations.${i}.school`}>{edu.school}</span>
                    <span className="ml-role"> &mdash; <span data-field={`educations.${i}.degree`}>{edu.degree}</span>{edu.field ? `, ${edu.field}` : ''}</span>
                  </div>
                  <span className="ml-dates">{edu.startDate} &ndash; {edu.endDate || 'Present'}</span>
                </div>
                {edu.gpa && <div style={{ fontSize: '8.5pt', color: 'var(--cv-secondary)', marginTop: 2 }}>GPA: {edu.gpa}</div>}
              </div>
            ))}
          </div>
        )}

        {profile.skills.length > 0 && (
          <div className="ml-section">
            <h2 className="ml-section-title">Skills</h2>
            <div className="ml-skills-list">
              {profile.skills.map((skill, i) => (
                <span key={i} className="ml-skill-pill">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {profile.projects.length > 0 && (
          <div className="ml-section">
            <h2 className="ml-section-title">Projects</h2>
            {profile.projects.map((proj, i) => (
              <div key={proj.id} className="ml-entry">
                <span className="ml-company" data-field={`projects.${i}.name`}>{proj.name}</span>
                {proj.url && <span style={{ fontSize: '8.5pt', color: 'var(--cv-accent)', marginLeft: 8 }}>{proj.url}</span>}
                <div style={{ color: 'var(--cv-secondary)', marginTop: 2 }} data-field={`projects.${i}.description`}>{proj.description}</div>
                {proj.technologies.length > 0 && (
                  <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {proj.technologies.map((t, i) => (
                      <span key={i} style={{ fontSize: '8pt', color: 'var(--cv-accent)', border: '1px solid var(--cv-accent)', padding: '1px 8px', borderRadius: 2 }}>{t}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {profile.languages.length > 0 && (
          <div className="ml-section">
            <h2 className="ml-section-title">Languages</h2>
            <div className="ml-skills-list">
              {profile.languages.map((lang, i) => (
                <span key={i} className="ml-skill-pill">{lang}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
