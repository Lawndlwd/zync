import type { Profile, CvTheme } from '@/types/jobs'

interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

export function BoldSidebarTemplate({ profile, theme }: TemplateProps) {
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

  const contactItems = [
    { label: 'Email', value: profile.email },
    { label: 'Phone', value: profile.phone },
    { label: 'Location', value: profile.location },
    { label: 'LinkedIn', value: profile.linkedin },
    { label: 'Website', value: profile.website },
  ].filter((c) => Boolean(c.value))

  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .cv-bold-sidebar {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          display: flex;
          background: var(--cv-bg);
          font-family: var(--cv-font-body);
          font-size: var(--cv-font-size);
          line-height: var(--cv-line-height);
          color: var(--cv-primary);
        }
        .cv-bold-sidebar .bs-sidebar {
          width: 72mm;
          min-height: 297mm;
          background: var(--cv-accent);
          color: #fff;
          padding: 20mm 8mm 20mm 10mm;
          box-sizing: border-box;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          gap: var(--cv-section-spacing);
        }
        .cv-bold-sidebar .bs-avatar {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--cv-font-heading);
          font-size: 26pt;
          font-weight: 700;
          color: #fff;
          margin: 0 auto 12px;
        }
        .cv-bold-sidebar .bs-sidebar-name {
          font-family: var(--cv-font-heading);
          font-size: 18pt;
          font-weight: 700;
          text-align: center;
          margin: 0;
          line-height: 1.2;
        }
        .cv-bold-sidebar .bs-sidebar-title {
          text-align: center;
          font-size: 9.5pt;
          opacity: 0.85;
          margin: 4px 0 0;
        }
        .cv-bold-sidebar .bs-sidebar-section-title {
          font-family: var(--cv-font-heading);
          font-size: 9pt;
          text-transform: uppercase;
          letter-spacing: 2px;
          border-bottom: 1px solid rgba(255,255,255,0.35);
          padding-bottom: 4px;
          margin: 0 0 8px;
          font-weight: 600;
        }
        .cv-bold-sidebar .bs-contact-item {
          margin-bottom: 8px;
        }
        .cv-bold-sidebar .bs-contact-label {
          font-size: 7.5pt;
          text-transform: uppercase;
          letter-spacing: 1px;
          opacity: 0.65;
          display: block;
        }
        .cv-bold-sidebar .bs-contact-value {
          font-size: 9pt;
          word-break: break-all;
        }
        .cv-bold-sidebar .bs-skill-row {
          margin-bottom: 6px;
        }
        .cv-bold-sidebar .bs-skill-name {
          font-size: 9pt;
          margin-bottom: 2px;
        }
        .cv-bold-sidebar .bs-skill-bar-track {
          height: 4px;
          background: rgba(255,255,255,0.2);
          border-radius: 2px;
        }
        .cv-bold-sidebar .bs-skill-bar-fill {
          height: 100%;
          background: #fff;
          border-radius: 2px;
          width: 80%;
        }
        .cv-bold-sidebar .bs-lang-item {
          font-size: 9pt;
          margin-bottom: 3px;
        }

        /* Main content */
        .cv-bold-sidebar .bs-main {
          flex: 1;
          padding: 20mm 18mm 20mm 14mm;
          box-sizing: border-box;
        }
        .cv-bold-sidebar .bs-section {
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-bold-sidebar .bs-section-title {
          font-family: var(--cv-font-heading);
          font-size: 12pt;
          font-weight: 700;
          color: var(--cv-accent);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin: 0 0 10px;
          border-bottom: 2px solid var(--cv-accent);
          padding-bottom: 4px;
        }
        .cv-bold-sidebar .bs-summary {
          color: var(--cv-secondary);
          font-size: 10pt;
          margin: 0;
        }
        .cv-bold-sidebar .bs-entry {
          margin-bottom: 14px;
        }
        .cv-bold-sidebar .bs-entry-dates {
          font-size: 8pt;
          color: var(--cv-accent);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .cv-bold-sidebar .bs-entry-title {
          font-weight: 700;
          color: var(--cv-primary);
          font-size: 11pt;
          margin: 2px 0 0;
        }
        .cv-bold-sidebar .bs-entry-sub {
          color: var(--cv-secondary);
          font-size: 9.5pt;
        }
        .cv-bold-sidebar .bs-bullets {
          margin: 4px 0 0 16px;
          padding: 0;
        }
        .cv-bold-sidebar .bs-bullets li {
          margin-bottom: 2px;
          font-size: 9.5pt;
        }
        .cv-bold-sidebar .bs-project {
          margin-bottom: 10px;
        }
        .cv-bold-sidebar .bs-project-name {
          font-weight: 700;
          color: var(--cv-primary);
        }
        .cv-bold-sidebar .bs-project-desc {
          color: var(--cv-secondary);
          font-size: 9.5pt;
          margin-top: 2px;
        }
        .cv-bold-sidebar .bs-project-tech {
          font-size: 8pt;
          color: var(--cv-accent);
          margin-top: 2px;
        }
        .cv-bold-sidebar [data-field] {
          cursor: text;
          transition: outline 0.15s;
          border-radius: 1px;
        }
        .cv-bold-sidebar [data-field]:hover {
          outline: 1px dashed rgba(108, 92, 231, 0.4);
          outline-offset: 2px;
        }
      `}} />
      <div className="cv-bold-sidebar" style={cssVars}>
        {/* Sidebar */}
        <div className="bs-sidebar">
          <div>
            <div className="bs-avatar">{initials}</div>
            <h1 className="bs-sidebar-name" data-field="name">{profile.name}</h1>
            <div className="bs-sidebar-title" data-field="title">{profile.title}</div>
          </div>

          {contactItems.length > 0 && (
            <div>
              <h2 className="bs-sidebar-section-title">Contact</h2>
              {contactItems.map((c, i) => (
                <div key={i} className="bs-contact-item">
                  <span className="bs-contact-label">{c.label}</span>
                  <span className="bs-contact-value">{c.value}</span>
                </div>
              ))}
            </div>
          )}

          {profile.skills.length > 0 && (
            <div>
              <h2 className="bs-sidebar-section-title">Skills</h2>
              {profile.skills.map((skill, i) => (
                <div key={i} className="bs-skill-row">
                  <div className="bs-skill-name">{skill}</div>
                  <div className="bs-skill-bar-track">
                    <div className="bs-skill-bar-fill" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {profile.languages.length > 0 && (
            <div>
              <h2 className="bs-sidebar-section-title">Languages</h2>
              {profile.languages.map((lang, i) => (
                <div key={i} className="bs-lang-item">{lang}</div>
              ))}
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="bs-main">
          {profile.summary && (
            <div className="bs-section">
              <h2 className="bs-section-title">Summary</h2>
              <p className="bs-summary" data-field="summary">{profile.summary}</p>
            </div>
          )}

          {profile.experiences.length > 0 && (
            <div className="bs-section">
              <h2 className="bs-section-title">Experience</h2>
              {profile.experiences.map((exp, i) => (
                <div key={exp.id} className="bs-entry">
                  <div className="bs-entry-dates">{exp.startDate} &ndash; {exp.endDate || 'Present'}</div>
                  <div className="bs-entry-title" data-field={`experiences.${i}.title`}>{exp.title}</div>
                  <div className="bs-entry-sub"><span data-field={`experiences.${i}.company`}>{exp.company}</span>{exp.location ? <span> &mdash; <span data-field={`experiences.${i}.location`}>{exp.location}</span></span> : ''}</div>
                  {exp.bullets.length > 0 && (
                    <ul className="bs-bullets">
                      {exp.bullets.map((b, j) => <li key={j} data-field={`experiences.${i}.bullets.${j}`}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {profile.educations.length > 0 && (
            <div className="bs-section">
              <h2 className="bs-section-title">Education</h2>
              {profile.educations.map((edu, i) => (
                <div key={edu.id} className="bs-entry">
                  <div className="bs-entry-dates">{edu.startDate} &ndash; {edu.endDate || 'Present'}</div>
                  <div className="bs-entry-title" data-field={`educations.${i}.degree`}>{edu.degree}{edu.field ? `, ${edu.field}` : ''}</div>
                  <div className="bs-entry-sub" data-field={`educations.${i}.school`}>{edu.school}</div>
                  {edu.gpa && <div style={{ fontSize: '8.5pt', color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>GPA: {edu.gpa}</div>}
                </div>
              ))}
            </div>
          )}

          {profile.projects.length > 0 && (
            <div className="bs-section">
              <h2 className="bs-section-title">Projects</h2>
              {profile.projects.map((proj, i) => (
                <div key={proj.id} className="bs-project">
                  <div className="bs-project-name" data-field={`projects.${i}.name`}>{proj.name}</div>
                  <div className="bs-project-desc" data-field={`projects.${i}.description`}>{proj.description}</div>
                  {proj.technologies.length > 0 && (
                    <div className="bs-project-tech">{proj.technologies.join(' \u00B7 ')}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
