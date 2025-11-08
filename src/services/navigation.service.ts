// Navigation Service - Dynamic navigation menus and structures
import { db } from "../db/client.ts";
import { navigationMenus, NavigationMenu } from "../db/schema.ts";
import { eq, and, desc } from "npm:drizzle-orm@0.35.3";

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon?: string;
  isActive?: boolean;
  isProtected?: boolean;
  requiresPermission?: string;
  children?: NavigationItem[];
  metadata?: Record<string, any>;
}

export interface NavigationMenuData {
  portalType: string;
  menuType: string;
  items: NavigationItem[];
  isActive?: boolean;
  sortOrder?: number;
}

export class NavigationService {
  
  async createNavigationMenu(data: NavigationMenuData, updatedBy?: number) {
    try {
      const [menu] = await db.insert(navigationMenus).values({
        portalType: data.portalType,
        menuType: data.menuType,
        items: data.items,
        isActive: data.isActive !== false,
        sortOrder: data.sortOrder || 0,
        updatedBy,
      }).returning();
      
      return menu;
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        throw new Error(`Navigation menu "${data.menuType}" already exists for portal "${data.portalType}"`);
      }
      throw new Error(`Failed to create navigation menu: ${error.message}`);
    }
  }

  async getNavigationMenus(portalType?: string) {
    try {
      let query = db.select().from(navigationMenus);
      
      if (portalType) {
        query = query.where(eq(navigationMenus.portalType, portalType));
      }
      
      return await query.orderBy(navigationMenus.sortOrder, navigationMenus.menuType);
    } catch (error) {
      throw new Error(`Failed to get navigation menus: ${error.message}`);
    }
  }

  async getNavigationMenu(portalType: string, menuType: string) {
    try {
      const [menu] = await db.select()
        .from(navigationMenus)
        .where(and(
          eq(navigationMenus.portalType, portalType),
          eq(navigationMenus.menuType, menuType)
        ));
      
      return menu || null;
    } catch (error) {
      throw new Error(`Failed to get navigation menu: ${error.message}`);
    }
  }

  async updateNavigationMenu(
    portalType: string, 
    menuType: string, 
    data: Partial<NavigationMenuData>, 
    updatedBy?: number
  ) {
    try {
      const [menu] = await db.update(navigationMenus)
        .set({
          ...data,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(and(
          eq(navigationMenus.portalType, portalType),
          eq(navigationMenus.menuType, menuType)
        ))
        .returning();
      
      return menu;
    } catch (error) {
      throw new Error(`Failed to update navigation menu: ${error.message}`);
    }
  }

  async deleteNavigationMenu(portalType: string, menuType: string) {
    try {
      const [deleted] = await db.delete(navigationMenus)
        .where(and(
          eq(navigationMenus.portalType, portalType),
          eq(navigationMenus.menuType, menuType)
        ))
        .returning();
      
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete navigation menu: ${error.message}`);
    }
  }

  // Get active navigation for a portal
  async getActiveNavigation(portalType: string, menuType: string) {
    try {
      const menu = await this.getNavigationMenu(portalType, menuType);
      
      if (!menu || !menu.isActive) {
        return null;
      }
      
      return menu.items;
    } catch (error) {
      throw new Error(`Failed to get active navigation: ${error.message}`);
    }
  }

  // Initialize default navigation structures
  async initializeDefaultNavigation(portalType: string, updatedBy?: number) {
    try {
      const defaults = this.getDefaultNavigationStructures(portalType);
      const results = [];
      
      for (const menuData of defaults) {
        const result = await this.createNavigationMenu(menuData, updatedBy);
        results.push(result);
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to initialize default navigation: ${error.message}`);
    }
  }

  // Portal-specific navigation helpers
  async getPortalNavigation(portalType: string) {
    try {
      const menus = await this.getNavigationMenus(portalType);
      
      const navigationStructure: Record<string, NavigationItem[]> = {};
      
      for (const menu of menus) {
        if (menu.isActive) {
          navigationStructure[menu.menuType] = menu.items;
        }
      }
      
      return navigationStructure;
    } catch (error) {
      throw new Error(`Failed to get portal navigation: ${error.message}`);
    }
  }

  // Utility methods for navigation manipulation
  async addNavigationItem(
    portalType: string, 
    menuType: string, 
    item: NavigationItem, 
    parentId?: string,
    updatedBy?: number
  ) {
    try {
      const menu = await this.getNavigationMenu(portalType, menuType);
      if (!menu) {
        throw new Error(`Navigation menu not found`);
      }
      
      const updatedItems = this.insertNavigationItem(menu.items, item, parentId);
      
      return await this.updateNavigationMenu(
        portalType, 
        menuType, 
        { items: updatedItems }, 
        updatedBy
      );
    } catch (error) {
      throw new Error(`Failed to add navigation item: ${error.message}`);
    }
  }

  async removeNavigationItem(
    portalType: string, 
    menuType: string, 
    itemId: string,
    updatedBy?: number
  ) {
    try {
      const menu = await this.getNavigationMenu(portalType, menuType);
      if (!menu) {
        throw new Error(`Navigation menu not found`);
      }
      
      const updatedItems = this.removeNavigationItemById(menu.items, itemId);
      
      return await this.updateNavigationMenu(
        portalType, 
        menuType, 
        { items: updatedItems }, 
        updatedBy
      );
    } catch (error) {
      throw new Error(`Failed to remove navigation item: ${error.message}`);
    }
  }

  async updateNavigationItem(
    portalType: string, 
    menuType: string, 
    itemId: string, 
    updates: Partial<NavigationItem>,
    updatedBy?: number
  ) {
    try {
      const menu = await this.getNavigationMenu(portalType, menuType);
      if (!menu) {
        throw new Error(`Navigation menu not found`);
      }
      
      const updatedItems = this.updateNavigationItemById(menu.items, itemId, updates);
      
      return await this.updateNavigationMenu(
        portalType, 
        menuType, 
        { items: updatedItems }, 
        updatedBy
      );
    } catch (error) {
      throw new Error(`Failed to update navigation item: ${error.message}`);
    }
  }

  // Private helper methods
  private getDefaultNavigationStructures(portalType: string): NavigationMenuData[] {
    const commonHeader: NavigationItem[] = [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: `/${portalType}/dashboard`,
        icon: 'dashboard',
        isActive: true
      },
      {
        id: 'search',
        label: 'Search',
        path: '/search',
        icon: 'search',
        isActive: true
      }
    ];

    const portalSpecificNavigation: Record<string, NavigationItem[]> = {
      creator: [
        {
          id: 'new-pitch',
          label: 'New Pitch',
          path: '/creator/pitch/new',
          icon: 'plus',
          isActive: true
        },
        {
          id: 'my-pitches',
          label: 'My Pitches',
          path: '/creator/pitches',
          icon: 'file-text',
          isActive: true
        },
        {
          id: 'analytics',
          label: 'Analytics',
          path: '/creator/analytics',
          icon: 'bar-chart',
          isActive: true
        },
        {
          id: 'ndas',
          label: 'NDAs',
          path: '/creator/ndas',
          icon: 'shield',
          isActive: true
        },
        {
          id: 'messages',
          label: 'Messages',
          path: '/creator/messages',
          icon: 'message-circle',
          isActive: true
        }
      ],
      investor: [
        {
          id: 'browse',
          label: 'Browse Projects',
          path: '/investor/browse',
          icon: 'search',
          isActive: true
        },
        {
          id: 'portfolio',
          label: 'Portfolio',
          path: '/investor/portfolio',
          icon: 'briefcase',
          isActive: true
        },
        {
          id: 'following',
          label: 'Following',
          path: '/investor/following',
          icon: 'heart',
          isActive: true
        },
        {
          id: 'messages',
          label: 'Messages',
          path: '/investor/messages',
          icon: 'message-circle',
          isActive: true
        }
      ],
      production: [
        {
          id: 'browse',
          label: 'Browse Projects',
          path: '/production/browse',
          icon: 'search',
          isActive: true
        },
        {
          id: 'projects',
          label: 'My Projects',
          path: '/production/projects',
          icon: 'folder',
          isActive: true
        },
        {
          id: 'following',
          label: 'Following',
          path: '/production/following',
          icon: 'heart',
          isActive: true
        },
        {
          id: 'messages',
          label: 'Messages',
          path: '/production/messages',
          icon: 'message-circle',
          isActive: true
        }
      ]
    };

    const userMenu: NavigationItem[] = [
      {
        id: 'profile',
        label: 'Profile',
        path: '/profile',
        icon: 'user',
        isActive: true
      },
      {
        id: 'settings',
        label: 'Settings',
        path: '/settings',
        icon: 'settings',
        isActive: true
      },
      {
        id: 'billing',
        label: 'Billing',
        path: `/${portalType}/billing`,
        icon: 'credit-card',
        isActive: true
      },
      {
        id: 'logout',
        label: 'Logout',
        path: '/logout',
        icon: 'log-out',
        isActive: true
      }
    ];

    return [
      {
        portalType,
        menuType: 'header',
        items: [
          ...commonHeader,
          ...(portalSpecificNavigation[portalType] || [])
        ],
        isActive: true,
        sortOrder: 1
      },
      {
        portalType,
        menuType: 'user',
        items: userMenu,
        isActive: true,
        sortOrder: 2
      }
    ];
  }

  private insertNavigationItem(
    items: NavigationItem[], 
    newItem: NavigationItem, 
    parentId?: string
  ): NavigationItem[] {
    if (!parentId) {
      return [...items, newItem];
    }

    return items.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          children: [...(item.children || []), newItem]
        };
      } else if (item.children) {
        return {
          ...item,
          children: this.insertNavigationItem(item.children, newItem, parentId)
        };
      }
      return item;
    });
  }

  private removeNavigationItemById(items: NavigationItem[], itemId: string): NavigationItem[] {
    return items.filter(item => {
      if (item.id === itemId) {
        return false;
      }
      if (item.children) {
        item.children = this.removeNavigationItemById(item.children, itemId);
      }
      return true;
    });
  }

  private updateNavigationItemById(
    items: NavigationItem[], 
    itemId: string, 
    updates: Partial<NavigationItem>
  ): NavigationItem[] {
    return items.map(item => {
      if (item.id === itemId) {
        return { ...item, ...updates };
      } else if (item.children) {
        return {
          ...item,
          children: this.updateNavigationItemById(item.children, itemId, updates)
        };
      }
      return item;
    });
  }
}

// Export singleton instance
export const navigationService = new NavigationService();