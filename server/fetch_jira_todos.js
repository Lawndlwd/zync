import { getMyJiraIssues } from './src/mcp-server/tools/jira.ts';
import 'dotenv/config';

(async () => {
  try {
    const result = await getMyJiraIssues({});
    const issues = JSON.parse(result);
    
    console.log('=== Your Jira Todos ===\n');
    
    if (issues.length === 0) {
      console.log('No Jira issues assigned to you.');
    } else {
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.key}: ${issue.summary}`);
        console.log(`   Status: ${issue.status}`);
        console.log(`   Priority: ${issue.priority}`);
        console.log('');
      });
      
      console.log(`Total: ${issues.length} issues`);
    }
  } catch (error) {
    console.error('Error fetching Jira issues:', error.message);
    if (error.stack) console.error(error.stack);
  }
})();