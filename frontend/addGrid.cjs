const fs = require('fs');
const path = require('path');

const dir = 'src/app/pages';
const files = [
  'cv/CVAnalysis.jsx',
  'courses/MyCourses.jsx',
  'account/Profile.jsx',
  'account/Settings.jsx',
  'home/Pricing.jsx',
  'interview/InterviewFeedback.jsx',
  'courses/CourseDetail.jsx',
  'mentors/MentorProfile.jsx',
];

for (const file of files) {
  const filepath = path.join(dir, file);
  if (!fs.existsSync(filepath)) continue;
  let content = fs.readFileSync(filepath, 'utf8');

  // Insert grid pattern if not exists
  if (!content.includes('40px 40px')) {
    const gridDiv = `
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
`;

    // Try multiple blob div structures commonly used across the files
    let replaced = false;
    
    // Pattern 1: opacity-10 with 2 inner divs (blur-3xl)
    const pat1 = /(<div className=\"absolute inset-0 opacity-10\">\s*<div[^>]+>\s*<\/[^>]+>\s*<div[^>]+>\s*<\/[^>]+>\s*<\/div>)/;
    if (pat1.test(content)) {
      content = content.replace(pat1, '$1' + gridDiv);
      replaced = true;
    }

    // Pattern 2: pointer-events-none with 2 inner divs 
    const pat2 = /(<div className=\"absolute inset-0 pointer-events-none\">\s*<div[^>]+>\s*<\/[^>]+>\s*<div[^>]+>\s*<\/[^>]+>\s*<\/div>)/;
    if (!replaced && pat2.test(content)) {
      content = content.replace(pat2, '$1' + gridDiv);
      replaced = true;
    }

    // Pattern 3: opacity-10 with 1 inner div (Settings.jsx etc)
    const pat3 = /(<div className=\"absolute inset-0 opacity-10\">\s*<div[^>]+>\s*<\/[^>]+>\s*<\/div>)/;
    if (!replaced && pat3.test(content)) {
      content = content.replace(pat3, '$1' + gridDiv);
      replaced = true;
    }

    if (replaced) {
      fs.writeFileSync(filepath, content);
      console.log('Added grid to', file);
    }
  }
}
