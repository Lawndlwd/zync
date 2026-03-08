import type { Profile, CvTheme } from '@zync/shared/types'

interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

export function MagazineTemplate({ profile, theme }: TemplateProps) {
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
        .cv-magazine {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          background: var(--cv-bg);
          font-family: var(--cv-font-body);
          font-size: var(--cv-font-size);
          line-height: var(--cv-line-height);
          color: var(--cv-primary);
        }
        .cv-magazine .mag-header {
          background: var(--cv-accent);
          padding: 12mm 18mm 10mm;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
        }
        .cv-magazine .mag-header-content {
          position: relative;
          z-index: 1;
        }
        .cv-magazine .mag-name {
          font-family: var(--cv-font-heading);
          font-size: 26pt;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          letter-spacing: -1px;
          line-height: 1.05;
        }
        .cv-magazine .mag-title {
          font-size: 14pt;
          color: rgba(255,255,255,0.85);
          margin: 6px 0 16px;
          font-weight: 400;
        }
        .cv-magazine .mag-contact-row {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          font-size: 9pt;
          color: rgba(255,255,255,0.75);
        }
        .cv-magazine .mag-photo {
          position: absolute;
          top: 8mm;
          right: 18mm;
          width: 35mm;
          height: 35mm;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: 3px solid rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28pt;
          color: rgba(255,255,255,0.3);
        }
        .cv-magazine .mag-body {
          padding: 16mm 22mm 20mm;
        }
        .cv-magazine .mag-quote {
          font-size: 10pt;
          font-style: italic;
          color: var(--cv-secondary);
          margin: 0 0 var(--cv-section-spacing);
          padding: 0 12px;
          position: relative;
          line-height: 1.6;
        }
        .cv-magazine .mag-quote::before {
          content: '\\201C';
          font-size: 36pt;
          font-style: normal;
          color: var(--cv-accent);
          position: absolute;
          left: -16px;
          top: -20px;
          line-height: 1;
          font-family: Georgia, serif;
          opacity: 0.6;
        }
        .cv-magazine .mag-grid {
          display: grid;
          grid-template-columns: 1fr 0.75fr;
          gap: 20px;
        }
        .cv-magazine .mag-col-left,
        .cv-magazine .mag-col-right {
          display: flex;
          flex-direction: column;
          gap: var(--cv-section-spacing);
        }
        .cv-magazine .mag-section-title {
          font-family: var(--cv-font-heading);
          font-size: 11pt;
          font-weight: 700;
          color: var(--cv-accent);
          margin: 0 0 10px;
        }
        .cv-magazine .mag-card {
          border: 1px solid color-mix(in srgb, var(--cv-primary) 12%, transparent);
          border-top: 3px solid var(--cv-accent);
          border-radius: 4px;
          padding: 10px 12px;
          margin-bottom: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .cv-magazine .mag-card:last-child {
          margin-bottom: 0;
        }
        .cv-magazine .mag-card-title {
          font-weight: 700;
          color: var(--cv-primary);
          margin-bottom: 1px;
        }
        .cv-magazine .mag-card-sub {
          font-size: 9pt;
          color: var(--cv-secondary);
          font-style: italic;
        }
        .cv-magazine .mag-card-dates {
          font-size: 8.5pt;
          color: var(--cv-secondary);
          margin-top: 2px;
        }
        .cv-magazine .mag-card-bullets {
          margin: 6px 0 0 14px;
          padding: 0;
          list-style-type: disc;
        }
        .cv-magazine .mag-card-bullets li {
          margin-bottom: 2px;
          font-size: calc(var(--cv-font-size) * 0.92);
        }
        .cv-magazine .mag-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }
        .cv-magazine .mag-chip {
          display: inline-block;
          padding: 3px 9px;
          font-size: 8pt;
          border-radius: 3px;
          background: color-mix(in srgb, var(--cv-accent) 12%, transparent);
          color: var(--cv-accent);
          font-weight: 500;
        }
        .cv-magazine .mag-lang-chip {
          display: inline-block;
          padding: 3px 9px;
          font-size: 8pt;
          border-radius: 3px;
          border: 1px solid var(--cv-accent);
          color: var(--cv-accent);
        }
        .cv-magazine .mag-proj-card {
          border: 1px solid color-mix(in srgb, var(--cv-primary) 12%, transparent);
          border-top: 3px solid var(--cv-accent);
          border-radius: 4px;
          padding: 10px 12px;
          margin-bottom: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.06);
        }
        .cv-magazine .mag-proj-card:last-child {
          margin-bottom: 0;
        }
        .cv-magazine .mag-proj-name {
          font-weight: 700;
          color: var(--cv-primary);
        }
        .cv-magazine .mag-proj-desc {
          font-size: 9pt;
          color: var(--cv-secondary);
          margin-top: 2px;
        }
        .cv-magazine .mag-proj-tech {
          font-size: 8pt;
          color: var(--cv-accent);
          margin-top: 4px;
        }
        .cv-magazine .mag-edu-gpa {
          font-size: 8.5pt;
          color: var(--cv-secondary);
          margin-top: 2px;
        }
        .cv-magazine [data-field] {
          cursor: text;
          transition: outline 0.15s;
          border-radius: 1px;
        }
        .cv-magazine [data-field]:hover {
          outline: 1px dashed color-mix(in srgb, var(--cv-accent) 50%, transparent);
          outline-offset: 2px;
        }
      `}} />
      <div className="cv-magazine" style={cssVars}>
        <div className="mag-header">
          {theme.showPhoto && (
            <div className="mag-photo">
              <span>?</span>
            </div>
          )}
          <div className="mag-header-content">
            <h1 className="mag-name" data-field="name">{profile.name}</h1>
            <div className="mag-title" data-field="title">{profile.title}</div>
            <div className="mag-contact-row">
              {contactItems.map((item, i) => (
                <span key={i}>{item}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="mag-body">
          {profile.summary && (
            <div className="mag-quote" data-field="summary">
              {profile.summary}
            </div>
          )}

          <div className="mag-grid">
            <div className="mag-col-left">
              {profile.experiences.length > 0 && (
                <div>
                  <h2 className="mag-section-title">Experience</h2>
                  {profile.experiences.map((exp, i) => (
                    <div key={exp.id} className="mag-card">
                      <div className="mag-card-title" data-field={`experiences.${i}.title`}>{exp.title}</div>
                      <div className="mag-card-sub"><span data-field={`experiences.${i}.company`}>{exp.company}</span>{exp.location ? <>, <span data-field={`experiences.${i}.location`}>{exp.location}</span></> : ''}</div>
                      <div className="mag-card-dates">{exp.startDate} &ndash; {exp.endDate || 'Present'}</div>
                      {exp.bullets.length > 0 && (
                        <ul className="mag-card-bullets">
                          {exp.bullets.map((b, j) => <li key={j} data-field={`experiences.${i}.bullets.${j}`}>{b}</li>)}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mag-col-right">
              {profile.educations.length > 0 && (
                <div>
                  <h2 className="mag-section-title">Education</h2>
                  {profile.educations.map((edu, i) => (
                    <div key={edu.id} className="mag-card">
                      <div className="mag-card-title"><span data-field={`educations.${i}.degree`}>{edu.degree}</span>{edu.field ? <>, <span data-field={`educations.${i}.field`}>{edu.field}</span></> : ''}</div>
                      <div className="mag-card-sub" data-field={`educations.${i}.school`}>{edu.school}</div>
                      <div className="mag-card-dates">{edu.startDate} &ndash; {edu.endDate || 'Present'}</div>
                      {edu.gpa && <div className="mag-edu-gpa">GPA: {edu.gpa}</div>}
                    </div>
                  ))}
                </div>
              )}

              {profile.skills.length > 0 && (
                <div>
                  <h2 className="mag-section-title">Skills</h2>
                  <div className="mag-chips">
                    {profile.skills.map((skill, i) => (
                      <span key={i} className="mag-chip">{skill}</span>
                    ))}
                  </div>
                </div>
              )}

              {profile.languages.length > 0 && (
                <div>
                  <h2 className="mag-section-title">Languages</h2>
                  <div className="mag-chips">
                    {profile.languages.map((lang, i) => (
                      <span key={i} className="mag-lang-chip">{lang}</span>
                    ))}
                  </div>
                </div>
              )}

              {profile.projects.length > 0 && (
                <div>
                  <h2 className="mag-section-title">Projects</h2>
                  {profile.projects.map((proj, i) => (
                    <div key={proj.id} className="mag-proj-card">
                      <div className="mag-proj-name" data-field={`projects.${i}.name`}>{proj.name}</div>
                      <div className="mag-proj-desc" data-field={`projects.${i}.description`}>{proj.description}</div>
                      {proj.technologies.length > 0 && (
                        <div className="mag-proj-tech">{proj.technologies.join(' / ')}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
