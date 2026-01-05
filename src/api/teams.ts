/**
 * Team Management API Endpoints
 * Handles team creation, management, invitations, and member operations
 */

import { ApiResponseBuilder, ErrorCode } from '../utils/api-response';
import { RBAC, Permission, UserRole } from '../middleware/rbac';

// Team interfaces
interface Team {
  id: number;
  name: string;
  description?: string;
  ownerId: number;
  visibility: 'private' | 'team' | 'public';
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  id: number;
  teamId: number;
  userId: number;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
  invitedBy?: number;
}

interface TeamInvite {
  id: number;
  teamId: number;
  invitedEmail: string;
  invitedById: number;
  role: 'editor' | 'viewer';
  status: 'pending' | 'accepted' | 'rejected';
  message?: string;
  createdAt: string;
  acceptedAt?: string;
  rejectedAt?: string;
}

export class TeamAPI {
  private db: any;
  private auth: any;
  
  constructor(db: any, auth: any) {
    this.db = db;
    this.auth = auth;
  }
  
  /**
   * Create a new team
   */
  async createTeam(request: Request): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      const { name, description, visibility = 'private' } = await request.json();
      
      // Validate input
      if (!name || name.length < 2 || name.length > 50) {
        return builder.error(ErrorCode.VALIDATION_ERROR, 'Team name must be between 2 and 50 characters');
      }
      
      // Check permissions
      const hasPermission = RBAC.hasPermission({
        userId: authResult.user.id,
        userRole: authResult.user.role as UserRole
      }, Permission.TEAM_MANAGE);
      
      if (!hasPermission) {
        return builder.error(ErrorCode.FORBIDDEN, 'You do not have permission to create teams');
      }
      
      // Create team
      const [team] = await this.db.query(`
        INSERT INTO teams (name, description, owner_id, visibility, created_at, updated_at)
        VALUES ('${name}', '${description || ''}', ${authResult.user.id}, '${visibility}', NOW(), NOW())
        RETURNING *
      `);
      
      // Add owner as a member
      await this.db.query(`
        INSERT INTO team_members (team_id, user_id, role, joined_at, invited_by)
        VALUES (${team.id}, ${authResult.user.id}, 'owner', NOW(), ${authResult.user.id})
      `);
      
      // Get team with members
      const teamWithMembers = await this.getTeamWithMembers(team.id);
      
      return builder.success({ team: teamWithMembers });
    } catch (error) {
      console.error('Error creating team:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to create team');
    }
  }
  
  /**
   * Get user's teams
   */
  async getTeams(request: Request): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Get teams where user is a member
      const teams = await this.db.query(`
        SELECT t.*, tm.role as user_role
        FROM teams t
        JOIN team_members tm ON t.id = tm.team_id
        WHERE tm.user_id = ${authResult.user.id}
        ORDER BY t.created_at DESC
      `);
      
      // Get members for each team
      const teamsWithMembers = await Promise.all(
        teams.map(async (team: any) => this.getTeamWithMembers(team.id))
      );
      
      return builder.success({ teams: teamsWithMembers });
    } catch (error) {
      console.error('Error getting teams:', error);
      return builder.success({ teams: [] }); // Return empty array on error
    }
  }
  
  /**
   * Get team details
   */
  async getTeam(request: Request, teamId: number): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Check if user is a member
      const [membership] = await this.db.query(`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${authResult.user.id}
      `);
      
      if (!membership) {
        return builder.error(ErrorCode.FORBIDDEN, 'You are not a member of this team');
      }
      
      const team = await this.getTeamWithMembers(teamId);
      
      return builder.success({ team });
    } catch (error) {
      console.error('Error getting team:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to get team details');
    }
  }
  
  /**
   * Update team details
   */
  async updateTeam(request: Request, teamId: number): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Check if user is team owner
      const [team] = await this.db.query(`
        SELECT * FROM teams WHERE id = ${teamId} AND owner_id = ${authResult.user.id}
      `);
      
      if (!team) {
        return builder.error(ErrorCode.FORBIDDEN, 'Only team owners can update team details');
      }
      
      const { name, description, visibility } = await request.json();
      
      // Build update query
      const updates = [];
      if (name) updates.push(`name = '${name}'`);
      if (description !== undefined) updates.push(`description = '${description}'`);
      if (visibility) updates.push(`visibility = '${visibility}'`);
      
      if (updates.length === 0) {
        return builder.error(ErrorCode.VALIDATION_ERROR, 'No updates provided');
      }
      
      // Update team
      const [updatedTeam] = await this.db.query(`
        UPDATE teams 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE id = ${teamId}
        RETURNING *
      `);
      
      const teamWithMembers = await this.getTeamWithMembers(updatedTeam.id);
      
      return builder.success({ team: teamWithMembers });
    } catch (error) {
      console.error('Error updating team:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to update team');
    }
  }
  
  /**
   * Delete team
   */
  async deleteTeam(request: Request, teamId: number): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Check if user is team owner
      const [team] = await this.db.query(`
        SELECT * FROM teams WHERE id = $1 AND owner_id = $2
      `, [teamId, authResult.user.id]);
      
      if (!team) {
        return builder.error(ErrorCode.FORBIDDEN, 'Only team owners can delete teams');
      }
      
      // Delete team (cascades to members and invites)
      await this.db.query(`DELETE FROM teams WHERE id = $1`, [teamId]);
      
      return builder.success({ message: 'Team deleted successfully' });
    } catch (error) {
      console.error('Error deleting team:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to delete team');
    }
  }
  
  /**
   * Invite member to team
   */
  async inviteMember(request: Request, teamId: number): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Check if user can invite (owner or editor)
      const [membership] = await this.db.query(`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${authResult.user.id}
      `);
      
      if (!membership || membership.role === 'viewer') {
        return builder.error(ErrorCode.FORBIDDEN, 'You do not have permission to invite members');
      }
      
      const { email, role = 'viewer', message } = await request.json();
      
      // Check if user already invited or member
      const [existingInvite] = await this.db.query(`
        SELECT * FROM team_invites 
        WHERE team_id = ${teamId} AND invited_email = '${email}' AND status = 'pending'
      `);
      
      if (existingInvite) {
        return builder.error(ErrorCode.CONFLICT, 'User already has a pending invitation');
      }
      
      // Check if user exists and is already a member
      const [user] = await this.db.query(`
        SELECT id FROM users WHERE email = '${email}'
      `);
      
      if (user) {
        const [existingMember] = await this.db.query(`
          SELECT * FROM team_members WHERE team_id = ${teamId} AND user_id = ${user.id}
        `);
        
        if (existingMember) {
          return builder.error(ErrorCode.CONFLICT, 'User is already a team member');
        }
      }
      
      // Create invitation
      const [invite] = await this.db.query(`
        INSERT INTO team_invites (team_id, invited_email, invited_by_id, role, status, message, created_at)
        VALUES (${teamId}, '${email}', ${authResult.user.id}, '${role}', 'pending', '${message || ''}', NOW())
        RETURNING *
      `);
      
      // TODO: Send email notification
      
      return builder.success({ invite });
    } catch (error) {
      console.error('Error inviting member:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to send invitation');
    }
  }
  
  /**
   * Get pending invites for user
   */
  async getInvites(request: Request): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      const invites = await this.db.query(`
        SELECT ti.*, t.name as team_name, u.name as invited_by
        FROM team_invites ti
        JOIN teams t ON ti.team_id = t.id
        JOIN users u ON ti.invited_by_id = u.id
        WHERE ti.invited_email = '${authResult.user.email}' 
        AND ti.status = 'pending'
        ORDER BY ti.created_at DESC
      `);
      
      return builder.success({ invites });
    } catch (error) {
      console.error('Error getting invites:', error);
      return builder.success({ invites: [] });
    }
  }
  
  /**
   * Accept team invitation
   */
  async acceptInvite(request: Request, inviteId: number): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Get invite
      const [invite] = await this.db.query(`
        SELECT * FROM team_invites 
        WHERE id = ${inviteId} 
        AND invited_email = '${authResult.user.email}'
        AND status = 'pending'
      `);
      
      if (!invite) {
        return builder.error(ErrorCode.NOT_FOUND, 'Invitation not found or already processed');
      }
      
      // Update invite status
      await this.db.query(`
        UPDATE team_invites 
        SET status = 'accepted', accepted_at = NOW() 
        WHERE id = ${inviteId}
      `);
      
      // Add user to team
      await this.db.query(`
        INSERT INTO team_members (team_id, user_id, role, joined_at, invited_by)
        VALUES (${invite.team_id}, ${authResult.user.id}, '${invite.role}', NOW(), ${invite.invited_by_id})
      `);
      
      return builder.success({ message: 'Invitation accepted' });
    } catch (error) {
      console.error('Error accepting invite:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to accept invitation');
    }
  }
  
  /**
   * Reject team invitation
   */
  async rejectInvite(request: Request, inviteId: number): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Update invite status
      const result = await this.db.query(`
        UPDATE team_invites 
        SET status = 'rejected', rejected_at = NOW() 
        WHERE id = ${inviteId} 
        AND invited_email = '${authResult.user.email}'
        AND status = 'pending'
      `);
      
      if (result.rowCount === 0) {
        return builder.error(ErrorCode.NOT_FOUND, 'Invitation not found or already processed');
      }
      
      return builder.success({ message: 'Invitation rejected' });
    } catch (error) {
      console.error('Error rejecting invite:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to reject invitation');
    }
  }
  
  /**
   * Update member role
   */
  async updateMemberRole(request: Request, teamId: number, memberId: number): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Check if user is team owner
      const [team] = await this.db.query(`
        SELECT * FROM teams WHERE id = ${teamId} AND owner_id = ${authResult.user.id}
      `);
      
      if (!team) {
        return builder.error(ErrorCode.FORBIDDEN, 'Only team owners can update member roles');
      }
      
      const { role } = await request.json();
      
      if (!['owner', 'editor', 'viewer'].includes(role)) {
        return builder.error(ErrorCode.VALIDATION_ERROR, 'Invalid role');
      }
      
      // Update member role
      await this.db.query(`
        UPDATE team_members 
        SET role = '${role}' 
        WHERE id = ${memberId} AND team_id = ${teamId}
      `);
      
      // If changing to owner, update team owner
      if (role === 'owner') {
        const [member] = await this.db.query(`
          SELECT user_id FROM team_members WHERE id = ${memberId}
        `);
        
        await this.db.query(`
          UPDATE teams SET owner_id = ${member.user_id} WHERE id = ${teamId}
        `);
        
        // Change current owner to editor
        await this.db.query(`
          UPDATE team_members 
          SET role = 'editor' 
          WHERE team_id = ${teamId} AND user_id = ${authResult.user.id}
        `);
      }
      
      return builder.success({ message: 'Role updated successfully' });
    } catch (error) {
      console.error('Error updating member role:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to update member role');
    }
  }
  
  /**
   * Remove member from team
   */
  async removeMember(request: Request, teamId: number, memberId: number): Promise<Response> {
    const authResult = await this.auth.requireAuth(request);
    if (!authResult.authorized) return authResult.response!;
    
    const builder = new ApiResponseBuilder(request);
    
    try {
      // Check permissions
      const [membership] = await this.db.query(`
        SELECT role FROM team_members 
        WHERE team_id = ${teamId} AND user_id = ${authResult.user.id}
      `);
      
      if (!membership || (membership.role !== 'owner' && membership.role !== 'editor')) {
        return builder.error(ErrorCode.FORBIDDEN, 'You do not have permission to remove members');
      }
      
      // Don't allow removing the owner
      const [member] = await this.db.query(`
        SELECT * FROM team_members WHERE id = ${memberId} AND team_id = ${teamId}
      `);
      
      if (!member) {
        return builder.error(ErrorCode.NOT_FOUND, 'Member not found');
      }
      
      if (member.role === 'owner') {
        return builder.error(ErrorCode.FORBIDDEN, 'Cannot remove team owner');
      }
      
      // Remove member
      await this.db.query(`
        DELETE FROM team_members WHERE id = ${memberId} AND team_id = ${teamId}
      `);
      
      return builder.success({ message: 'Member removed successfully' });
    } catch (error) {
      console.error('Error removing member:', error);
      return builder.error(ErrorCode.INTERNAL_ERROR, 'Failed to remove member');
    }
  }
  
  /**
   * Helper: Get team with members
   */
  private async getTeamWithMembers(teamId: number): Promise<any> {
    const [team] = await this.db.query(`
      SELECT * FROM teams WHERE id = ${teamId}
    `);
    
    if (!team) return null;
    
    const members = await this.db.query(`
      SELECT tm.*, u.name, u.email, u.avatar_url as avatar
      FROM team_members tm
      JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = ${teamId}
      ORDER BY 
        CASE tm.role 
          WHEN 'owner' THEN 1
          WHEN 'editor' THEN 2
          WHEN 'viewer' THEN 3
        END,
        tm.joined_at
    `);
    
    return {
      ...team,
      members
    };
  }
}

// Export mock team endpoints for testing
export const mockTeamEndpoints = {
  createTeam: async () => ({
    success: true,
    data: {
      team: {
        id: 1,
        name: 'Test Team',
        description: 'A test team',
        ownerId: 1,
        visibility: 'private',
        createdAt: new Date().toISOString(),
        members: [{
          id: 1,
          userId: 1,
          name: 'Alex Thompson',
          email: 'alex@example.com',
          role: 'owner',
          joinedAt: new Date().toISOString()
        }]
      }
    }
  }),
  
  getTeams: async () => ({
    success: true,
    data: {
      teams: [
        {
          id: 1,
          name: 'Creative Team',
          description: 'Main creative team',
          ownerId: 1,
          visibility: 'team',
          members: [
            { id: 1, name: 'Alex Thompson', role: 'owner' },
            { id: 2, name: 'Sarah Chen', role: 'editor' }
          ]
        },
        {
          id: 2,
          name: 'Production Team',
          description: 'Production coordination',
          ownerId: 2,
          visibility: 'private',
          members: [
            { id: 3, name: 'Mike Johnson', role: 'owner' },
            { id: 4, name: 'Emma Wilson', role: 'viewer' }
          ]
        }
      ]
    }
  }),
  
  inviteMember: async () => ({
    success: true,
    data: {
      invite: {
        id: 1,
        teamId: 1,
        invitedEmail: 'newmember@example.com',
        role: 'viewer',
        status: 'pending',
        createdAt: new Date().toISOString()
      }
    }
  })
};