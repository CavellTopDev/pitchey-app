import { Ticket, TicketStatus, TicketPriority, UserType } from './ticket-system';

export interface SupportAgent {
  id: string;
  name: string;
  email: string;
  specializations: UserType[];
  currentWorkload: number;
  availabilityStatus: 'available' | 'busy' | 'away'
}

export class AgentDashboard {
  private agents: SupportAgent[] = [];
  private tickets: Ticket[] = [];

  // Assigns ticket to most appropriate agent
  assignTicket(ticket: Ticket): SupportAgent | null {
    const eligibleAgents = this.agents.filter(agent => 
      agent.specializations.includes(ticket.userType) && 
      agent.availabilityStatus === 'available'
    );

    // Sort agents by current workload
    const sortedAgents = eligibleAgents.sort((a, b) => a.currentWorkload - b.currentWorkload);

    if (sortedAgents.length > 0) {
      const selectedAgent = sortedAgents[0];
      selectedAgent.currentWorkload++;
      return selectedAgent;
    }

    return null;
  }

  // Agent performance dashboard
  generateAgentPerformanceSummary(agentId: string, timeframe: 'daily' | 'weekly' | 'monthly') {
    const agentTickets = this.tickets.filter(ticket => ticket.assignedAgentId === agentId);

    return {
      totalTicketsHandled: agentTickets.length,
      resolvedTickets: agentTickets.filter(t => t.status === TicketStatus.RESOLVED).length,
      averageResolutionTime: this.calculateAverageResolutionTime(agentTickets),
      priorityDistribution: this.calculatePriorityDistribution(agentTickets)
    };
  }

  // Calculates average ticket resolution time
  private calculateAverageResolutionTime(tickets: Ticket[]): number {
    const resolvedTickets = tickets.filter(t => t.resolvedAt);
    
    if (resolvedTickets.length === 0) return 0;

    const totalResolutionTime = resolvedTickets.reduce((total, ticket) => {
      if (ticket.resolvedAt) {
        return total + (ticket.resolvedAt.getTime() - ticket.createdAt.getTime());
      }
      return total;
    }, 0);

    return totalResolutionTime / resolvedTickets.length / (1000 * 60 * 60); // hours
  }

  // Calculates priority distribution of tickets
  private calculatePriorityDistribution(tickets: Ticket[]): Record<TicketPriority, number> {
    return tickets.reduce((dist, ticket) => {
      dist[ticket.priority] = (dist[ticket.priority] || 0) + 1;
      return dist;
    }, {} as Record<TicketPriority, number>);
  }

  // Live workload management
  getLiveWorkloadStatus(): WorkloadSummary {
    return {
      totalOpenTickets: this.tickets.filter(t => t.status !== TicketStatus.CLOSED).length,
      ticketsByPriority: Object.values(TicketPriority).reduce((summary, priority) => {
        summary[priority] = this.tickets.filter(t => t.priority === priority && t.status !== TicketStatus.CLOSED).length;
        return summary;
      }, {} as Record<TicketPriority, number>),
      averageWaitTime: this.calculateAverageWaitTime()
    };
  }

  private calculateAverageWaitTime(): number {
    const openTickets = this.tickets.filter(t => t.status !== TicketStatus.CLOSED);
    
    if (openTickets.length === 0) return 0;

    const totalWaitTime = openTickets.reduce((total, ticket) => {
      return total + (new Date().getTime() - ticket.createdAt.getTime());
    }, 0);

    return totalWaitTime / openTickets.length / (1000 * 60); // minutes
  }
}

interface WorkloadSummary {
  totalOpenTickets: number;
  ticketsByPriority: Record<TicketPriority, number>;
  averageWaitTime: number;
}