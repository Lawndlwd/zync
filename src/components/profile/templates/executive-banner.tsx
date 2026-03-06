import type { Profile, CvTheme } from '@/types/jobs'

interface TemplateProps {
  profile: Profile
  theme: CvTheme
}

export function ExecutiveBannerTemplate({ profile, theme }: TemplateProps) {
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
        .cv-executive-banner {
          width: 210mm;
          min-height: 297mm;
          box-sizing: border-box;
          background: var(--cv-bg);
          font-family: var(--cv-font-body);
          font-size: var(--cv-font-size);
          line-height: var(--cv-line-height);
          color: var(--cv-primary);
        }
        .cv-executive-banner .eb-banner {
          background: var(--cv-accent);
          padding: 24mm 24mm 0;
          position: relative;
        }
        .cv-executive-banner .eb-banner-name {
          font-family: var(--cv-font-heading);
          font-size: 28pt;
          font-weight: 700;
          color: #fff;
          margin: 0;
          line-height: 1.1;
        }
        .cv-executive-banner .eb-banner-title {
          color: rgba(255,255,255,0.8);
          font-size: 12pt;
          margin: 4px 0 0;
        }
        .cv-executive-banner .eb-contact-strip {
          margin-top: 14px;
          background: rgba(255,255,255,0.15);
          padding: 8px 24mm;
          margin-left: -24mm;
          margin-right: -24mm;
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          font-size: 8.5pt;
          color: rgba(255,255,255,0.9);
        }
        .cv-executive-banner .eb-body {
          display: flex;
          gap: 20px;
          padding: 18mm 24mm 20mm;
        }
        .cv-executive-banner .eb-left {
          flex: 65;
          min-width: 0;
        }
        .cv-executive-banner .eb-right {
          flex: 35;
          min-width: 0;
        }
        .cv-executive-banner .eb-section {
          margin-bottom: var(--cv-section-spacing);
        }
        .cv-executive-banner .eb-section-title {
          font-family: var(--cv-font-heading);
          font-size: 11pt;
          font-weight: 700;
          color: var(--cv-primary);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .cv-executive-banner .eb-section-dot {
          width: 8px;
          height: 8px;
          background: var(--cv-accent);
          border-radius: 1px;
          flex-shrink: 0;
        }
        .cv-executive-banner .eb-summary {
          color: var(--cv-secondary);
          font-size: 10pt;
          margin: 0;
        }
        .cv-executive-banner .eb-entry {
          margin-bottom: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid #e5e5e5;
        }
        .cv-executive-banner .eb-entry:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .cv-executive-banner .eb-entry-company {
          font-weight: 700;
          color: var(--cv-primary);
          font-size: 11pt;
        }
        .cv-executive-banner .eb-entry-role {
          color: var(--cv-accent);
          font-size: 10pt;
        }
        .cv-executive-banner .eb-entry-dates {
          font-size: 8.5pt;
          color: var(--cv-secondary);
          margin-top: 1px;
        }
        .cv-executive-banner .eb-bullets {
          margin: 5px 0 0 16px;
          padding: 0;
        }
        .cv-executive-banner .eb-bullets li {
          margin-bottom: 2px;
          font-size: 9.5pt;
        }
        .cv-executive-banner .eb-edu-entry {
          margin-bottom: 10px;
        }
        .cv-executive-banner .eb-edu-degree {
          font-weight: 700;
          color: var(--cv-primary);
        }
        .cv-executive-banner .eb-edu-school {
          color: var(--cv-secondary);
          font-size: 9.5pt;
        }
        .cv-executive-banner .eb-edu-dates {
          font-size: 8.5pt;
          color: var(--cv-secondary);
        }

        /* Right column */
        .cv-executive-banner .eb-skill-group {
          margin-bottom: 10px;
        }
        .cv-executive-banner .eb-skill-tag {
          display: inline-block;
          font-size: 8.5pt;
          color: var(--cv-accent);
          border: 1px solid var(--cv-accent);
          padding: 2px 10px;
          border-radius: 2px;
          margin: 0 5px 5px 0;
        }
        .cv-executive-banner .eb-project {
          margin-bottom: 10px;
        }
        .cv-executive-banner .eb-project-name {
          font-weight: 700;
          font-size: 10pt;
          color: var(--cv-primary);
        }
        .cv-executive-banner .eb-project-desc {
          font-size: 9pt;
          color: var(--cv-secondary);
          margin-top: 2px;
        }
        .cv-executive-banner .eb-project-tech {
          font-size: 8pt;
          color: var(--cv-accent);
          margin-top: 2px;
        }
        .cv-executive-banner .eb-lang-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .cv-executive-banner .eb-lang-list li {
          font-size: 9.5pt;
          margin-bottom: 3px;
          color: var(--cv-primary);
        }
        .cv-executive-banner [data-field] {
          cursor: text;
          transition: outline 0.15s;
          border-radius: 1px;
        }
        .cv-executive-banner [data-field]:hover {
          outline: 1px dashed rgba(108, 92, 231, 0.4);
          outline-offset: 2px;
        }
      `}} />
      <div className="cv-executive-banner" style={cssVars}>
        {/* Banner */}
        <div className="eb-banner">
          <h1 className="eb-banner-name" data-field="name">{profile.name}</h1>
          <div className="eb-banner-title" data-field="title">{profile.title}</div>
          <div className="eb-contact-strip">
            {contactItems.map((item, i) => (
              <span key={i}>{item}</span>
            ))}
          </div>
        </div>

        {/* Two-column body */}
        <div className="eb-body">
          {/* Left column — main content */}
          <div className="eb-left">
            {profile.summary && (
              <div className="eb-section">
                <h2 className="eb-section-title">
                  <span className="eb-section-dot" />
                  Summary
                </h2>
                <p className="eb-summary" data-field="summary">{profile.summary}</p>
              </div>
            )}

            {profile.experiences.length > 0 && (
              <div className="eb-section">
                <h2 className="eb-section-title">
                  <span className="eb-section-dot" />
                  Experience
                </h2>
                {profile.experiences.map((exp, i) => (
                  <div key={exp.id} className="eb-entry">
                    <div className="eb-entry-company" data-field={`experiences.${i}.company`}>{exp.company}</div>
                    <div className="eb-entry-role" data-field={`experiences.${i}.title`}>{exp.title}</div>
                    <div className="eb-entry-dates">{exp.startDate} &ndash; {exp.endDate || 'Present'}{exp.location ? <span> &middot; <span data-field={`experiences.${i}.location`}>{exp.location}</span></span> : ''}</div>
                    {exp.bullets.length > 0 && (
                      <ul className="eb-bullets">
                        {exp.bullets.map((b, j) => <li key={j} data-field={`experiences.${i}.bullets.${j}`}>{b}</li>)}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            {profile.educations.length > 0 && (
              <div className="eb-section">
                <h2 className="eb-section-title">
                  <span className="eb-section-dot" />
                  Education
                </h2>
                {profile.educations.map((edu, i) => (
                  <div key={edu.id} className="eb-edu-entry">
                    <div className="eb-edu-degree" data-field={`educations.${i}.degree`}>{edu.degree}{edu.field ? `, ${edu.field}` : ''}</div>
                    <div className="eb-edu-school" data-field={`educations.${i}.school`}>{edu.school}</div>
                    <div className="eb-edu-dates">{edu.startDate} &ndash; {edu.endDate || 'Present'}{edu.gpa ? ` \u00B7 GPA: ${edu.gpa}` : ''}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column — sidebar content */}
          <div className="eb-right">
            {profile.skills.length > 0 && (
              <div className="eb-section">
                <h2 className="eb-section-title">
                  <span className="eb-section-dot" />
                  Skills
                </h2>
                <div className="eb-skill-group">
                  {profile.skills.map((skill, i) => (
                    <span key={i} className="eb-skill-tag">{skill}</span>
                  ))}
                </div>
              </div>
            )}

            {profile.projects.length > 0 && (
              <div className="eb-section">
                <h2 className="eb-section-title">
                  <span className="eb-section-dot" />
                  Projects
                </h2>
                {profile.projects.map((proj, i) => (
                  <div key={proj.id} className="eb-project">
                    <div className="eb-project-name" data-field={`projects.${i}.name`}>{proj.name}</div>
                    <div className="eb-project-desc" data-field={`projects.${i}.description`}>{proj.description}</div>
                    {proj.technologies.length > 0 && (
                      <div className="eb-project-tech">{proj.technologies.join(' \u00B7 ')}</div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {profile.languages.length > 0 && (
              <div className="eb-section">
                <h2 className="eb-section-title">
                  <span className="eb-section-dot" />
                  Languages
                </h2>
                <ul className="eb-lang-list">
                  {profile.languages.map((lang, i) => (
                    <li key={i}>{lang}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
