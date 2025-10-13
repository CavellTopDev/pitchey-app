// Content Management Service - Dynamic content for portal customization
import { db } from "../db/client.ts";
import { 
  contentTypes, 
  contentItems, 
  contentApprovals,
  ContentType,
  ContentItem,
  ContentApproval
} from "../db/schema.ts";
import { eq, and, desc, sql, or, isNull } from "drizzle-orm";

export interface ContentItemData {
  contentTypeId?: number;
  key: string;
  portalType?: string;
  locale?: string;
  content: Record<string, any>;
  metadata?: Record<string, any>;
  status?: string;
  version?: number;
}

export interface ContentFilter {
  portalType?: string;
  locale?: string;
  status?: string;
  contentTypeId?: number;
  keys?: string[];
}

export class ContentManagementService {
  
  // Content Types Management
  async createContentType(data: {
    name: string;
    description?: string;
    schema?: Record<string, any>;
  }) {
    try {
      const [contentType] = await db.insert(contentTypes).values({
        name: data.name,
        description: data.description,
        schema: data.schema || {},
      }).returning();
      
      return contentType;
    } catch (error) {
      throw new Error(`Failed to create content type: ${error.message}`);
    }
  }

  async getContentTypes() {
    try {
      return await db.select().from(contentTypes).orderBy(desc(contentTypes.createdAt));
    } catch (error) {
      throw new Error(`Failed to get content types: ${error.message}`);
    }
  }

  async getContentType(id: number) {
    try {
      const [contentType] = await db.select().from(contentTypes).where(eq(contentTypes.id, id));
      return contentType || null;
    } catch (error) {
      throw new Error(`Failed to get content type: ${error.message}`);
    }
  }

  // Content Items Management
  async createContentItem(data: ContentItemData, createdBy?: number) {
    try {
      const [contentItem] = await db.insert(contentItems).values({
        contentTypeId: data.contentTypeId,
        key: data.key,
        portalType: data.portalType,
        locale: data.locale || "en",
        content: data.content,
        metadata: data.metadata || {},
        status: data.status || "active",
        version: data.version || 1,
        createdBy,
        updatedBy: createdBy,
      }).returning();
      
      return contentItem;
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        throw new Error(`Content item with key "${data.key}" already exists for this portal and locale`);
      }
      throw new Error(`Failed to create content item: ${error.message}`);
    }
  }

  async getContentItems(filter: ContentFilter = {}) {
    try {
      let query = db.select().from(contentItems);
      
      const conditions = [];
      
      if (filter.portalType) {
        conditions.push(eq(contentItems.portalType, filter.portalType));
      }
      
      if (filter.locale) {
        conditions.push(eq(contentItems.locale, filter.locale));
      }
      
      if (filter.status) {
        conditions.push(eq(contentItems.status, filter.status));
      }
      
      if (filter.contentTypeId) {
        conditions.push(eq(contentItems.contentTypeId, filter.contentTypeId));
      }
      
      if (filter.keys && filter.keys.length > 0) {
        conditions.push(sql`${contentItems.key} = ANY(${filter.keys})`);
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      return await query.orderBy(desc(contentItems.updatedAt));
    } catch (error) {
      throw new Error(`Failed to get content items: ${error.message}`);
    }
  }

  async getContentItem(id: number) {
    try {
      const [contentItem] = await db.select().from(contentItems).where(eq(contentItems.id, id));
      return contentItem || null;
    } catch (error) {
      throw new Error(`Failed to get content item: ${error.message}`);
    }
  }

  async getContentByKey(key: string, portalType?: string, locale = "en") {
    try {
      const conditions = [eq(contentItems.key, key), eq(contentItems.locale, locale)];
      
      if (portalType) {
        conditions.push(or(
          eq(contentItems.portalType, portalType),
          isNull(contentItems.portalType)
        ));
      }
      
      const [contentItem] = await db.select()
        .from(contentItems)
        .where(and(...conditions))
        .orderBy(desc(contentItems.updatedAt))
        .limit(1);
      
      return contentItem || null;
    } catch (error) {
      throw new Error(`Failed to get content by key: ${error.message}`);
    }
  }

  async updateContentItem(id: number, data: Partial<ContentItemData>, updatedBy?: number) {
    try {
      const [contentItem] = await db.update(contentItems)
        .set({
          ...data,
          updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(contentItems.id, id))
        .returning();
      
      return contentItem;
    } catch (error) {
      throw new Error(`Failed to update content item: ${error.message}`);
    }
  }

  async deleteContentItem(id: number) {
    try {
      const [deleted] = await db.delete(contentItems)
        .where(eq(contentItems.id, id))
        .returning();
      
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete content item: ${error.message}`);
    }
  }

  // Bulk operations for portal content
  async getPortalContent(portalType: string, locale = "en") {
    try {
      const items = await this.getContentItems({ portalType, locale, status: "active" });
      
      // Transform into a flat object structure for easy frontend consumption
      const contentMap: Record<string, any> = {};
      
      for (const item of items) {
        contentMap[item.key] = item.content;
      }
      
      return contentMap;
    } catch (error) {
      throw new Error(`Failed to get portal content: ${error.message}`);
    }
  }

  async updatePortalContent(portalType: string, contentUpdates: Record<string, any>, updatedBy?: number, locale = "en") {
    try {
      const results = [];
      
      for (const [key, content] of Object.entries(contentUpdates)) {
        const existing = await this.getContentByKey(key, portalType, locale);
        
        if (existing) {
          const updated = await this.updateContentItem(existing.id, { content }, updatedBy);
          results.push(updated);
        } else {
          const created = await this.createContentItem({
            key,
            portalType,
            locale,
            content,
          }, updatedBy);
          results.push(created);
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Failed to update portal content: ${error.message}`);
    }
  }

  // Content versioning
  async createContentVersion(id: number, updatedBy?: number) {
    try {
      const existing = await this.getContentItem(id);
      if (!existing) {
        throw new Error("Content item not found");
      }
      
      const newVersion = await this.createContentItem({
        contentTypeId: existing.contentTypeId,
        key: existing.key,
        portalType: existing.portalType,
        locale: existing.locale,
        content: existing.content,
        metadata: existing.metadata,
        status: "draft",
        version: existing.version + 1,
      }, updatedBy);
      
      return newVersion;
    } catch (error) {
      throw new Error(`Failed to create content version: ${error.message}`);
    }
  }

  // Content approval workflow
  async requestApproval(contentItemId: number, requestedBy: number, comments?: string) {
    try {
      const [approval] = await db.insert(contentApprovals).values({
        contentItemId,
        requestedBy,
        comments,
        status: "pending",
      }).returning();
      
      return approval;
    } catch (error) {
      throw new Error(`Failed to request content approval: ${error.message}`);
    }
  }

  async approveContent(approvalId: number, reviewedBy: number, comments?: string) {
    try {
      const [approval] = await db.update(contentApprovals)
        .set({
          status: "approved",
          reviewedBy,
          comments,
          reviewedAt: new Date(),
        })
        .where(eq(contentApprovals.id, approvalId))
        .returning();
      
      // Activate the content
      if (approval) {
        await db.update(contentItems)
          .set({ status: "active" })
          .where(eq(contentItems.id, approval.contentItemId));
      }
      
      return approval;
    } catch (error) {
      throw new Error(`Failed to approve content: ${error.message}`);
    }
  }

  async rejectContent(approvalId: number, reviewedBy: number, comments?: string) {
    try {
      const [approval] = await db.update(contentApprovals)
        .set({
          status: "rejected",
          reviewedBy,
          comments,
          reviewedAt: new Date(),
        })
        .where(eq(contentApprovals.id, approvalId))
        .returning();
      
      return approval;
    } catch (error) {
      throw new Error(`Failed to reject content: ${error.message}`);
    }
  }

  // Search and filtering
  async searchContent(searchTerm: string, filter: ContentFilter = {}) {
    try {
      let query = db.select().from(contentItems);
      
      const conditions = [];
      
      // Add search conditions
      if (searchTerm) {
        conditions.push(
          or(
            sql`${contentItems.key} ILIKE ${`%${searchTerm}%`}`,
            sql`${contentItems.content}::text ILIKE ${`%${searchTerm}%`}`
          )
        );
      }
      
      // Add filter conditions
      if (filter.portalType) {
        conditions.push(eq(contentItems.portalType, filter.portalType));
      }
      
      if (filter.locale) {
        conditions.push(eq(contentItems.locale, filter.locale));
      }
      
      if (filter.status) {
        conditions.push(eq(contentItems.status, filter.status));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      return await query.orderBy(desc(contentItems.updatedAt));
    } catch (error) {
      throw new Error(`Failed to search content: ${error.message}`);
    }
  }
}

// Export singleton instance
export const contentManagementService = new ContentManagementService();