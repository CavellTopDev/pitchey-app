#!/usr/bin/env python3
"""
Fix SQL queries to use withDatabase wrapper
"""
import re

def fix_sql_queries(content):
    """Wrap SQL queries with withDatabase"""
    
    # Pattern to match SQL template literals that span multiple lines
    # Matches: const/let variable = await sql`...`
    pattern1 = r'(const|let)\s+(\w+)\s*=\s*await\s+sql\s*`([^`]+)`'
    replacement1 = r'\1 \2 = await withDatabase(env, async (sql) => await sql`\3`, sentry)'
    
    # Pattern for direct await sql without assignment
    pattern2 = r'await\s+sql\s*`([^`]+)`'
    replacement2 = r'await withDatabase(env, async (sql) => await sql`\1`, sentry)'
    
    # Apply replacements
    content = re.sub(pattern1, replacement1, content, flags=re.MULTILINE | re.DOTALL)
    
    # For remaining patterns not caught by the first
    lines = content.split('\n')
    result = []
    in_sql = False
    sql_start_line = -1
    indent = ''
    var_declaration = ''
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Check if this line starts a SQL query
        if 'await sql`' in line and 'withDatabase' not in line:
            in_sql = True
            sql_start_line = i
            # Get the indentation
            indent = len(line) - len(line.lstrip())
            indent_str = ' ' * indent
            
            # Check if it's an assignment
            if '=' in line.split('await sql`')[0]:
                var_part = line.split('=')[0].strip()
                # Replace the line
                result.append(f"{indent_str}{var_part} = await withDatabase(env, async (sql) => await sql`")
            else:
                # Direct await without assignment
                leading = line.split('await sql`')[0]
                result.append(f"{leading}await withDatabase(env, async (sql) => await sql`")
            
            # If the SQL ends on the same line
            if '`;' in line:
                in_sql = False
                # Complete the replacement
                sql_content = line.split('`')[1].split('`')[0] if '`' in line else ''
                result[-1] = result[-1].replace('await sql`', f'await sql`{sql_content}`') + ', sentry);'
            
            i += 1
            continue
            
        # Check if we're ending a SQL query
        if in_sql and '`;' in line:
            in_sql = False
            # Replace the backtick ending with the wrapper ending
            result.append(line.replace('`;', '`, sentry);'))
            i += 1
            continue
            
        # Normal line
        result.append(line)
        i += 1
    
    return '\n'.join(result)

# Read the file
with open('src/worker-service-optimized.ts', 'r') as f:
    content = f.read()

# Fix the queries
fixed_content = fix_sql_queries(content)

# Write back
with open('src/worker-service-optimized.ts', 'w') as f:
    f.write(fixed_content)

print("✅ Fixed SQL queries to use withDatabase wrapper")
print("   Note: Some complex queries may need manual review")