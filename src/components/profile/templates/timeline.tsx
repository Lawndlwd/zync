import type { Profile, CvTheme } from '@/types/jobs'

interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

export function TimelineTemplate({ profile, theme }: TemplateProps) {
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
        .cv-timeline {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          padding: 18mm 22mm;
          background: var(--cv-bg);
          font-family: var(--cv-font-body);
          font-size: var(--cv-font-size);
          line-height: var(--cv-line-height);
          color: var(--cv-primary);
        }
        .cv-timeline .tl-header {
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-timeline .tl-name {
          font-family: var(--cv-font-heading);
          font-size: 30pt;
          font-weight: 700;
          color: var(--cv-primary);
          margin: 0;
          letter-spacing: -0.5px;
        }
        .cv-timeline .tl-title {
          font-size: 12pt;
          color: var(--cv-accent);
          margin: 4px 0 10px;
          font-weight: 500;
        }
        .cv-timeline .tl-contact {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          font-size: 9pt;
          color: var(--cv-secondary);
        }
        .cv-timeline .tl-contact-item::before {
          content: '';
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--cv-accent);
          margin-right: 6px;
          vertical-align: middle;
        }
        .cv-timeline .tl-section {
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-timeline .tl-section-title {
          font-family: var(--cv-font-heading);
          font-size: 11pt;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: var(--cv-primary);
          margin: 0 0 14px;
        }
        .cv-timeline .tl-track {
          position: relative;
          padding-left: 160px;
        }
        .cv-timeline .tl-track::before {
          content: '';
          position: absolute;
          left: 128px;
          top: 6px;
          bottom: 6px;
          width: 3px;
          background: var(--cv-accent);
          opacity: 0.3;
          border-radius: 2px;
        }
        .cv-timeline .tl-entry {
          position: relative;
          margin-bottom: 16px;
          padding-bottom: 4px;
        }
        .cv-timeline .tl-entry:last-child {
          margin-bottom: 0;
        }
        .cv-timeline .tl-dot {
          position: absolute;
          left: -38px;
          top: 5px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--cv-accent);
          border: 2px solid var(--cv-bg);
          box-shadow: 0 0 0 2px var(--cv-accent);
        }
        .cv-timeline .tl-date {
          position: absolute;
          left: -156px;
          top: 2px;
          width: 108px;
          text-align: right;
          font-size: 8.5pt;
          color: var(--cv-secondary);
          white-space: nowrap;
        }
        .cv-timeline .tl-entry-title {
          font-weight: 700;
          color: var(--cv-primary);
        }
        .cv-timeline .tl-entry-sub {
          color: var(--cv-secondary);
          font-style: italic;
        }
        .cv-timeline .tl-bullets {
          margin: 4px 0 0 16px;
          padding: 0;
        }
        .cv-timeline .tl-bullets li {
          margin-bottom: 2px;
        }
        .cv-timeline .tl-summary {
          color: var(--cv-secondary);
          font-size: 10pt;
          margin-bottom: var(--cv-section-spacing);
          padding-left: 0;
        }
        .cv-timeline .tl-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .cv-timeline .tl-chip {
          display: inline-block;
          padding: 3px 10px;
          font-size: 8.5pt;
          border-radius: 12px;
          background: var(--cv-accent);
          color: var(--cv-bg);
          font-weight: 500;
        }
        .cv-timeline .tl-chip-outline {
          display: inline-block;
          padding: 3px 10px;
          font-size: 8.5pt;
          border-radius: 12px;
          border: 1px solid var(--cv-accent);
          color: var(--cv-accent);
        }
        .cv-timeline .tl-proj-card {
          margin-bottom: 10px;
          padding: 8px 12px;
          border-left: 3px solid var(--cv-accent);
          background: color-mix(in srgb, var(--cv-accent) 5%, transparent);
        }
        .cv-timeline .tl-proj-title {
          font-weight: 700;
          color: var(--cv-primary);
        }
        .cv-timeline .tl-proj-desc {
          font-size: 9.5pt;
          color: var(--cv-secondary);
          margin-top: 2px;
        }
        .cv-timeline .tl-proj-tech {
          font-size: 8.5pt;
          color: var(--cv-accent);
          margin-top: 2px;
        }
        .cv-timeline .tl-edu-gpa {
          font-size: 9pt;
          color: var(--cv-secondary);
          margin-top: 2px;
        }
      `}} />
      <div className="cv-timeline" style={cssVars}>
        <div className="tl-header">
          <h1 className="tl-name">{profile.name}</h1>
          <div className="tl-title">{profile.title}</div>
          <div className="tl-contact">
            {contactItems.map((item, i) => (
              <span key={i} className="tl-contact-item">{item}</span>
            ))}
          </div>
        </div>

        {profile.summary && (
          <p className="tl-summary">{profile.summary}</p>
        )}

        {profile.experiences.length > 0 && (
          <div className="tl-section">
            <h2 className="tl-section-title">Experience</h2>
            <div className="tl-track">
              {profile.experiences.map((exp) => (
                <div key={exp.id} className="tl-entry">
                  <div className="tl-dot" />
                  <div className="tl-date">{exp.startDate} &ndash; {exp.endDate || 'Present'}</div>
                  <div className="tl-entry-title">{exp.title}</div>
                  <div className="tl-entry-sub">{exp.company}{exp.location ? `, ${exp.location}` : ''}</div>
                  {exp.bullets.length > 0 && (
                    <ul className="tl-bullets">
                      {exp.bullets.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.educations.length > 0 && (
          <div className="tl-section">
            <h2 className="tl-section-title">Education</h2>
            <div className="tl-track">
              {profile.educations.map((edu) => (
                <div key={edu.id} className="tl-entry">
                  <div className="tl-dot" />
                  <div className="tl-date">{edu.startDate} &ndash; {edu.endDate || 'Present'}</div>
                  <div className="tl-entry-title">{edu.degree}{edu.field ? `, ${edu.field}` : ''}</div>
                  <div className="tl-entry-sub">{edu.school}</div>
                  {edu.gpa && <div className="tl-edu-gpa">GPA: {edu.gpa}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {profile.skills.length > 0 && (
          <div className="tl-section">
            <h2 className="tl-section-title">Skills</h2>
            <div className="tl-chips">
              {profile.skills.map((skill, i) => (
                <span key={i} className="tl-chip">{skill}</span>
              ))}
            </div>
          </div>
        )}

        {profile.projects.length > 0 && (
          <div className="tl-section">
            <h2 className="tl-section-title">Projects</h2>
            {profile.projects.map((proj) => (
              <div key={proj.id} className="tl-proj-card">
                <div className="tl-proj-title">{proj.name}</div>
                <div className="tl-proj-desc">{proj.description}</div>
                {proj.technologies.length > 0 && (
                  <div className="tl-proj-tech">{proj.technologies.join(' / ')}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {profile.languages.length > 0 && (
          <div className="tl-section">
            <h2 className="tl-section-title">Languages</h2>
            <div className="tl-chips">
              {profile.languages.map((lang, i) => (
                <span key={i} className="tl-chip-outline">{lang}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
