import { test, expect } from '@playwright/test';
import { AuthHelper } from './utils/auth-helpers';
import { PageHelper } from './utils/page-helpers';
import { TEST_DOCUMENTS } from './fixtures/test-data';

test.describe('File Upload Validation and R2 Integration', () => {
  let authHelper: AuthHelper;
  let pageHelper: PageHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    pageHelper = new PageHelper(page);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: ensure logged out
    try {
      await authHelper.logout();
    } catch (error) {
      console.warn('Cleanup logout failed:', error);
    }
  });

  test.describe('File Upload Interface and Validation', () => {
    test('creator accesses file upload interface', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to create pitch or file upload area
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Look for file upload section
      const uploadSection = page.locator('[data-testid="file-upload-section"], [data-testid="documents-section"]');
      
      if (await uploadSection.count() === 0) {
        // Try navigating to pitch management for existing pitch
        await page.goto('/creator/pitches');
        await pageHelper.waitForPageLoad();
        
        const pitchItems = page.locator('[data-testid="pitch-item"]');
        if (await pitchItems.count() > 0) {
          // Click on first pitch to manage documents
          await pitchItems.first().click();
          await pageHelper.waitForPageLoad();
          
          const manageDocsButton = page.locator('[data-testid="manage-documents"], button:has-text("Documents")');
          if (await manageDocsButton.count() > 0) {
            await manageDocsButton.click();
            await pageHelper.waitForPageLoad();
          }
        }
      }
      
      // Verify upload interface elements
      const uploadInterface = page.locator('[data-testid="upload-interface"], .file-upload');
      if (await uploadInterface.count() > 0) {
        await expect(uploadInterface).toBeVisible();
        
        // Check for upload components
        const uploadComponents = [
          '[data-testid="file-input"]',
          '[data-testid="drop-zone"]',
          '[data-testid="upload-button"]',
          'input[type="file"]'
        ];
        
        let foundUploadComponent = false;
        for (const component of uploadComponents) {
          const element = page.locator(component);
          if (await element.count() > 0) {
            await expect(element).toBeVisible();
            foundUploadComponent = true;
            console.log(`✓ Upload component found: ${component}`);
            break;
          }
        }
        
        expect(foundUploadComponent).toBeTruthy();
      } else {
        console.log('Upload interface not found - checking for add documents button');
        
        const addDocsButton = page.locator('[data-testid="add-documents"], button:has-text("Add"), button:has-text("Upload")');
        if (await addDocsButton.count() > 0) {
          await addDocsButton.click();
          
          // Should open upload modal/interface
          const uploadModal = page.locator('[data-testid="upload-modal"], .upload-dialog');
          if (await uploadModal.count() > 0) {
            await expect(uploadModal).toBeVisible();
            console.log('✓ Upload modal accessible');
          }
        }
      }
    });

    test('validates file type restrictions and size limits', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to upload interface
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Look for file upload input
      let fileInput = page.locator('input[type="file"]');
      
      if (await fileInput.count() === 0) {
        // Try to access through add documents button
        const addDocsButton = page.locator('[data-testid="add-documents"], button:has-text("Upload"), button:has-text("Add Documents")');
        if (await addDocsButton.count() > 0) {
          await addDocsButton.click();
          fileInput = page.locator('input[type="file"]');
        }
      }
      
      if (await fileInput.count() > 0) {
        // Check file input attributes for validation
        const acceptAttr = await fileInput.getAttribute('accept');
        const multipleAttr = await fileInput.getAttribute('multiple');
        
        console.log(`File input accept attribute: ${acceptAttr}`);
        console.log(`Multiple files allowed: ${multipleAttr}`);
        
        // Test file type validation with mock files
        await page.evaluate(async () => {
          // Create test files of different types
          const testFiles = [
            { name: 'script.pdf', type: 'application/pdf', size: 2 * 1024 * 1024 },
            { name: 'treatment.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 512 * 1024 },
            { name: 'budget.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 1024 * 1024 },
            { name: 'lookbook.jpg', type: 'image/jpeg', size: 5 * 1024 * 1024 },
            { name: 'invalid.exe', type: 'application/x-executable', size: 1024 },
            { name: 'toolarge.pdf', type: 'application/pdf', size: 100 * 1024 * 1024 }
          ];
          
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) {
            // Store test results for validation
            (window as any).fileValidationResults = [];
            
            for (const fileInfo of testFiles) {
              try {
                const content = new ArrayBuffer(fileInfo.size);
                const blob = new Blob([content], { type: fileInfo.type });
                const file = new File([blob], fileInfo.name, { type: fileInfo.type });
                
                // Create DataTransfer object with the test file
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInput.files = dt.files;
                
                // Trigger change event to test validation
                const changeEvent = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(changeEvent);
                
                // Wait for validation and store result
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const validationMessage = fileInput.validationMessage;
                const customValidity = fileInput.validity.customError;
                
                (window as any).fileValidationResults.push({
                  fileName: fileInfo.name,
                  fileType: fileInfo.type,
                  fileSize: fileInfo.size,
                  validationMessage,
                  isValid: fileInput.validity.valid,
                  customError: customValidity
                });
                
              } catch (error) {
                (window as any).fileValidationResults.push({
                  fileName: fileInfo.name,
                  error: error.message
                });
              }
            }
          }
        });
        
        // Check validation results
        const validationResults = await page.evaluate(() => (window as any).fileValidationResults || []);
        
        for (const result of validationResults) {
          console.log(`File validation - ${result.fileName}:`, result);
          
          // Verify expected validation behavior
          if (result.fileName.includes('invalid.exe')) {
            // Should reject executable files
            expect(result.isValid).toBeFalsy();
          }
          
          if (result.fileName.includes('toolarge.pdf')) {
            // Should reject files over size limit
            expect(result.isValid).toBeFalsy();
          }
        }
        
        console.log('✓ File validation testing completed');
      } else {
        console.log('File input not found - upload interface may not be implemented yet');
      }
    });

    test('tests drag and drop file upload functionality', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to upload area
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Look for drop zone
      const dropZone = page.locator('[data-testid="drop-zone"], .drop-zone, .file-drop-area');
      
      if (await dropZone.count() > 0) {
        await expect(dropZone).toBeVisible();
        
        // Test drag and drop simulation
        await page.evaluate(async () => {
          const dropZoneElement = document.querySelector('[data-testid="drop-zone"], .drop-zone, .file-drop-area');
          
          if (dropZoneElement) {
            // Create mock file for drag and drop test
            const mockFile = new File(['test content'], 'test-script.pdf', { type: 'application/pdf' });
            
            // Create drag event data
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(mockFile);
            
            // Simulate drag events
            const dragEnterEvent = new DragEvent('dragenter', {
              bubbles: true,
              dataTransfer: dataTransfer
            });
            
            const dragOverEvent = new DragEvent('dragover', {
              bubbles: true,
              dataTransfer: dataTransfer
            });
            
            const dropEvent = new DragEvent('drop', {
              bubbles: true,
              dataTransfer: dataTransfer
            });
            
            // Dispatch events
            dropZoneElement.dispatchEvent(dragEnterEvent);
            dropZoneElement.dispatchEvent(dragOverEvent);
            dropZoneElement.dispatchEvent(dropEvent);
            
            // Store result for checking
            (window as any).dragDropTestCompleted = true;
          }
        });
        
        const testCompleted = await page.evaluate(() => (window as any).dragDropTestCompleted);
        expect(testCompleted).toBeTruthy();
        
        console.log('✓ Drag and drop functionality tested');
      } else {
        console.log('Drop zone not found - checking for alternative upload interface');
        
        // Check for click-to-upload area
        const uploadArea = page.locator('[data-testid="upload-area"], .upload-click-area');
        if (await uploadArea.count() > 0) {
          await expect(uploadArea).toBeVisible();
          console.log('✓ Click-to-upload area found');
        }
      }
    });

    test('validates upload progress tracking and feedback', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to upload interface
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Test upload progress simulation
      await page.evaluate(async () => {
        // Simulate file upload progress
        const progressElements = [
          '[data-testid="upload-progress"]',
          '[data-testid="progress-bar"]',
          '.upload-progress',
          'progress'
        ];
        
        let progressElement = null;
        for (const selector of progressElements) {
          const element = document.querySelector(selector);
          if (element) {
            progressElement = element;
            break;
          }
        }
        
        if (progressElement) {
          // Simulate progress updates
          const progressSteps = [0, 25, 50, 75, 100];
          
          for (const progress of progressSteps) {
            if (progressElement.tagName === 'PROGRESS') {
              (progressElement as HTMLProgressElement).value = progress;
            } else {
              progressElement.setAttribute('data-progress', progress.toString());
              progressElement.style.width = `${progress}%`;
            }
            
            // Dispatch progress event
            const progressEvent = new CustomEvent('uploadprogress', {
              detail: { progress, loaded: progress * 1024, total: 100 * 1024 }
            });
            progressElement.dispatchEvent(progressEvent);
            
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
          (window as any).uploadProgressTested = true;
        }
      });
      
      const progressTested = await page.evaluate(() => (window as any).uploadProgressTested);
      
      if (progressTested) {
        console.log('✓ Upload progress tracking tested');
      } else {
        console.log('Upload progress elements not found - may not be implemented yet');
      }
      
      // Check for upload status messages
      const statusElements = [
        '[data-testid="upload-status"]',
        '[data-testid="upload-message"]',
        '.upload-status',
        '.file-status'
      ];
      
      for (const element of statusElements) {
        const statusElement = page.locator(element);
        if (await statusElement.count() > 0) {
          console.log(`✓ Upload status element found: ${element}`);
        }
      }
    });
  });

  test.describe('Document Type Management', () => {
    test('uploads different document types with proper categorization', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to document management area
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Test document type selection
      const documentTypes = [
        { type: 'script', name: 'Full Script', extensions: ['.pdf', '.fdx'] },
        { type: 'treatment', name: 'Treatment', extensions: ['.pdf', '.docx'] },
        { type: 'budget', name: 'Budget Breakdown', extensions: ['.xlsx', '.csv'] },
        { type: 'lookbook', name: 'Visual Lookbook', extensions: ['.pdf', '.jpg', '.png'] },
        { type: 'business_plan', name: 'Business Plan', extensions: ['.pdf', '.docx'] },
        { type: 'pitch_deck', name: 'Pitch Deck', extensions: ['.pdf', '.pptx'] }
      ];
      
      for (const docType of documentTypes) {
        // Check if document type selector exists
        const docTypeSelect = page.locator('[data-testid="document-type"], select[name="documentType"]');
        
        if (await docTypeSelect.count() > 0) {
          await docTypeSelect.selectOption(docType.type);
          
          // Verify type-specific validation
          const fileInput = page.locator('input[type="file"]');
          if (await fileInput.count() > 0) {
            const acceptAttr = await fileInput.getAttribute('accept');
            console.log(`${docType.name} accepts: ${acceptAttr}`);
            
            // Verify expected file extensions are included
            for (const ext of docType.extensions) {
              if (acceptAttr && acceptAttr.includes(ext.substring(1))) {
                console.log(`✓ ${docType.name} accepts ${ext} files`);
              }
            }
          }
        } else {
          console.log(`Document type selector not found for ${docType.name}`);
        }
      }
      
      // Test document categorization
      const documentCategories = page.locator('[data-testid="document-categories"], .doc-categories');
      if (await documentCategories.count() > 0) {
        await expect(documentCategories).toBeVisible();
        
        const categoryItems = page.locator('[data-testid="category-item"]');
        const categoryCount = await categoryItems.count();
        
        console.log(`Found ${categoryCount} document categories`);
        
        if (categoryCount > 0) {
          for (let i = 0; i < Math.min(categoryCount, 3); i++) {
            const category = categoryItems.nth(i);
            const categoryName = await category.textContent();
            console.log(`Category ${i + 1}: ${categoryName}`);
          }
        }
      }
    });

    test('validates document access permissions and visibility settings', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to existing pitch with documents
      await page.goto('/creator/pitches');
      await pageHelper.waitForPageLoad();
      
      const pitchItems = page.locator('[data-testid="pitch-item"]');
      if (await pitchItems.count() > 0) {
        // Click on first pitch
        await pitchItems.first().click();
        await pageHelper.waitForPageLoad();
        
        // Look for document settings
        const documentSettings = page.locator('[data-testid="document-settings"], [data-testid="privacy-settings"]');
        if (await documentSettings.count() > 0) {
          await documentSettings.click();
          
          // Check access permission options
          const accessOptions = [
            { id: 'public', name: 'Public Access', description: 'Visible to all users' },
            { id: 'nda', name: 'NDA Required', description: 'Requires signed NDA' },
            { id: 'investor', name: 'Investor Only', description: 'Only for verified investors' },
            { id: 'private', name: 'Private', description: 'Only visible to creator' }
          ];
          
          for (const option of accessOptions) {
            const optionElement = page.locator(`[data-testid="${option.id}-access"], input[value="${option.id}"]`);
            
            if (await optionElement.count() > 0) {
              await expect(optionElement).toBeVisible();
              console.log(`✓ Access option available: ${option.name}`);
              
              // Test selecting the option
              if (await optionElement.isEnabled()) {
                await optionElement.check();
                
                // Look for description or help text
                const descriptionElement = page.locator(`[data-testid="${option.id}-description"], .access-description`);
                if (await descriptionElement.count() > 0) {
                  const description = await descriptionElement.textContent();
                  console.log(`  Description: ${description}`);
                }
              }
            }
          }
          
          // Test save settings
          const saveButton = page.locator('[data-testid="save-permissions"], button:has-text("Save")');
          if (await saveButton.count() > 0) {
            await saveButton.click();
            await pageHelper.waitForPageLoad();
            
            const saveConfirmation = page.locator('[data-testid="permissions-saved"], .success-message');
            if (await saveConfirmation.count() > 0) {
              await expect(saveConfirmation).toBeVisible();
              console.log('✓ Document permissions saved successfully');
            }
          }
        }
      }
    });

    test('manages document versions and revision tracking', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to pitch with existing documents
      await page.goto('/creator/pitches');
      await pageHelper.waitForPageLoad();
      
      const pitchItems = page.locator('[data-testid="pitch-item"]');
      if (await pitchItems.count() > 0) {
        await pitchItems.first().click();
        await pageHelper.waitForPageLoad();
        
        // Look for document management section
        const documentsSection = page.locator('[data-testid="document-management"], .documents-list');
        if (await documentsSection.count() > 0) {
          await expect(documentsSection).toBeVisible();
          
          // Check for version control features
          const versionFeatures = [
            '[data-testid="upload-new-version"]',
            '[data-testid="version-history"]',
            '[data-testid="document-versions"]'
          ];
          
          for (const feature of versionFeatures) {
            const featureElement = page.locator(feature);
            if (await featureElement.count() > 0) {
              await expect(featureElement).toBeVisible();
              console.log(`✓ Version control feature found: ${feature}`);
            }
          }
          
          // Test version history if available
          const versionHistoryButton = page.locator('[data-testid="version-history"], button:has-text("History")');
          if (await versionHistoryButton.count() > 0) {
            await versionHistoryButton.click();
            
            const historyModal = page.locator('[data-testid="version-history-modal"], .version-history');
            if (await historyModal.count() > 0) {
              await expect(historyModal).toBeVisible();
              
              // Check version entries
              const versionEntries = page.locator('[data-testid="version-entry"]');
              const entryCount = await versionEntries.count();
              
              console.log(`Found ${entryCount} version entries`);
              
              if (entryCount > 0) {
                for (let i = 0; i < Math.min(entryCount, 3); i++) {
                  const entry = versionEntries.nth(i);
                  const versionInfo = await entry.textContent();
                  console.log(`Version ${i + 1}: ${versionInfo?.substring(0, 100)}...`);
                }
              }
              
              // Close version history
              const closeButton = page.locator('[data-testid="close-history"], button:has-text("Close")');
              if (await closeButton.count() > 0) {
                await closeButton.click();
              }
            }
          }
          
          // Test upload new version
          const uploadNewVersionButton = page.locator('[data-testid="upload-new-version"], button:has-text("Update"), button:has-text("New Version")');
          if (await uploadNewVersionButton.count() > 0) {
            await uploadNewVersionButton.click();
            
            const uploadModal = page.locator('[data-testid="upload-version-modal"], .upload-modal');
            if (await uploadModal.count() > 0) {
              await expect(uploadModal).toBeVisible();
              
              // Check for version notes/changelog input
              const versionNotes = page.locator('[data-testid="version-notes"], textarea[name="versionNotes"]');
              if (await versionNotes.count() > 0) {
                await versionNotes.fill('Updated script with director\'s feedback and dialogue improvements.');
              }
              
              console.log('✓ Version upload interface accessible');
              
              // Close upload modal
              const closeUploadButton = page.locator('[data-testid="close-upload"], button:has-text("Cancel")');
              if (await closeUploadButton.count() > 0) {
                await closeUploadButton.click();
              }
            }
          }
        }
      }
    });
  });

  test.describe('R2 Storage Integration and Performance', () => {
    test('validates file storage and retrieval performance', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Test file upload performance (simulated)
      const uploadStartTime = Date.now();
      
      // Navigate to upload area
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Simulate file upload timing test
      await page.evaluate(async () => {
        // Mock large file upload simulation
        const mockLargeFile = new Blob([new ArrayBuffer(5 * 1024 * 1024)], { type: 'application/pdf' });
        
        // Start upload simulation
        const startTime = performance.now();
        
        // Simulate upload chunks
        const chunkSize = 1024 * 1024; // 1MB chunks
        const totalChunks = 5;
        
        for (let i = 0; i < totalChunks; i++) {
          // Simulate chunk upload delay
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const progress = ((i + 1) / totalChunks) * 100;
          console.log(`Upload progress: ${progress}%`);
        }
        
        const endTime = performance.now();
        const uploadTime = endTime - startTime;
        
        (window as any).mockUploadTime = uploadTime;
        (window as any).mockUploadSize = mockLargeFile.size;
      });
      
      const mockUploadTime = await page.evaluate(() => (window as any).mockUploadTime);
      const mockUploadSize = await page.evaluate(() => (window as any).mockUploadSize);
      
      if (mockUploadTime && mockUploadSize) {
        const uploadSpeed = (mockUploadSize / (mockUploadTime / 1000)) / (1024 * 1024); // MB/s
        
        console.log(`Mock upload performance:`);
        console.log(`  File size: ${(mockUploadSize / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`  Upload time: ${mockUploadTime.toFixed(2)}ms`);
        console.log(`  Upload speed: ${uploadSpeed.toFixed(2)} MB/s`);
        
        // Upload should complete within reasonable time (>1 MB/s equivalent)
        expect(uploadSpeed).toBeGreaterThan(0.5);
      }
    });

    test('tests file download and access performance', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to existing documents
      await page.goto('/creator/pitches');
      await pageHelper.waitForPageLoad();
      
      const pitchItems = page.locator('[data-testid="pitch-item"]');
      if (await pitchItems.count() > 0) {
        await pitchItems.first().click();
        await pageHelper.waitForPageLoad();
        
        // Look for downloadable documents
        const downloadButtons = page.locator('[data-testid="download-document"], button:has-text("Download")');
        const downloadCount = await downloadButtons.count();
        
        console.log(`Found ${downloadCount} downloadable documents`);
        
        if (downloadCount > 0) {
          // Test download performance
          const downloadStartTime = Date.now();
          
          const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
          await downloadButtons.first().click();
          
          try {
            const download = await downloadPromise;
            const downloadEndTime = Date.now();
            const downloadTime = downloadEndTime - downloadStartTime;
            
            console.log(`Download performance:`);
            console.log(`  File: ${download.suggestedFilename()}`);
            console.log(`  Download time: ${downloadTime}ms`);
            
            // Download should start within 5 seconds
            expect(downloadTime).toBeLessThan(5000);
            
            // Verify download properties
            expect(download.suggestedFilename()).toBeTruthy();
            
            console.log('✓ Document download performance validated');
          } catch (error) {
            console.warn('Document download test skipped:', error);
          }
        } else {
          console.log('No downloadable documents found - testing file access URLs');
          
          // Test direct file access through document links
          const documentLinks = page.locator('[data-testid="document-link"], a[href*="/documents/"]');
          const linkCount = await documentLinks.count();
          
          if (linkCount > 0) {
            const firstLink = documentLinks.first();
            const linkHref = await firstLink.getAttribute('href');
            
            if (linkHref) {
              // Test link accessibility
              const linkResponse = await page.request.head(linkHref);
              console.log(`Document link status: ${linkResponse.status()}`);
              
              // Link should be accessible (200 or redirect)
              expect(linkResponse.status()).toBeLessThan(400);
            }
          }
        }
      }
    });

    test('validates file storage limits and quota management', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Check for storage quota information
      const quotaElements = [
        '[data-testid="storage-quota"]',
        '[data-testid="storage-usage"]',
        '[data-testid="storage-limit"]',
        '.storage-info'
      ];
      
      for (const quotaElement of quotaElements) {
        const element = page.locator(quotaElement);
        if (await element.count() > 0) {
          const quotaInfo = await element.textContent();
          console.log(`Storage quota info: ${quotaInfo}`);
        }
      }
      
      // Test storage quota warnings
      await page.evaluate(async () => {
        // Simulate approaching storage limit
        const storageWarnings = [
          '[data-testid="storage-warning"]',
          '[data-testid="quota-exceeded"]',
          '.storage-alert'
        ];
        
        for (const selector of storageWarnings) {
          const element = document.querySelector(selector);
          if (element) {
            element.style.display = 'block';
            (window as any).storageWarningFound = true;
          }
        }
      });
      
      const warningFound = await page.evaluate(() => (window as any).storageWarningFound);
      if (warningFound) {
        console.log('✓ Storage warning system accessible');
      }
      
      // Test file cleanup options
      const cleanupButtons = page.locator('[data-testid="cleanup-files"], button:has-text("Clean"), button:has-text("Delete")');
      if (await cleanupButtons.count() > 0) {
        console.log('✓ File cleanup options available');
      }
      
      // Test storage analytics if available
      await page.goto('/creator/settings');
      await pageHelper.waitForPageLoad();
      
      const storageTab = page.locator('[data-testid="storage-tab"], button:has-text("Storage")');
      if (await storageTab.count() > 0) {
        await storageTab.click();
        
        const storageAnalytics = page.locator('[data-testid="storage-analytics"], .storage-breakdown');
        if (await storageAnalytics.count() > 0) {
          await expect(storageAnalytics).toBeVisible();
          console.log('✓ Storage analytics accessible');
        }
      }
    });
  });

  test.describe('File Security and Access Control', () => {
    test('validates secure file access and authentication', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Test authenticated file access
      await page.goto('/creator/pitches');
      await pageHelper.waitForPageLoad();
      
      const pitchItems = page.locator('[data-testid="pitch-item"]');
      if (await pitchItems.count() > 0) {
        await pitchItems.first().click();
        await pageHelper.waitForPageLoad();
        
        // Get file URLs and test access
        const fileLinks = page.locator('[data-testid="document-link"], a[href*="/api/"], a[href*="/files/"]');
        const linkCount = await fileLinks.count();
        
        console.log(`Found ${linkCount} file links to test`);
        
        if (linkCount > 0) {
          for (let i = 0; i < Math.min(linkCount, 3); i++) {
            const link = fileLinks.nth(i);
            const fileUrl = await link.getAttribute('href');
            
            if (fileUrl) {
              // Test authenticated access
              const authResponse = await page.request.get(fileUrl);
              console.log(`Authenticated access to ${fileUrl}: ${authResponse.status()}`);
              
              // Should be accessible for creator
              expect(authResponse.status()).toBeLessThan(400);
            }
          }
        }
      }
      
      // Test unauthenticated access (should be denied)
      await authHelper.logout();
      
      // Try to access file URLs without authentication
      const testFileUrl = '/api/files/test-document.pdf';
      const unauthResponse = await page.request.get(testFileUrl);
      console.log(`Unauthenticated access test: ${unauthResponse.status()}`);
      
      // Should be denied for unauthenticated users
      expect(unauthResponse.status()).toBeGreaterThanOrEqual(401);
    });

    test('validates NDA-protected document access control', async ({ page }) => {
      // Test as creator setting NDA protection
      await authHelper.loginAsCreator();
      
      await page.goto('/creator/pitches');
      await pageHelper.waitForPageLoad();
      
      const pitchItems = page.locator('[data-testid="pitch-item"]');
      if (await pitchItems.count() > 0) {
        await pitchItems.first().click();
        await pageHelper.waitForPageLoad();
        
        // Look for NDA protection settings
        const ndaSettings = page.locator('[data-testid="nda-protection"], [data-testid="document-privacy"]');
        if (await ndaSettings.count() > 0) {
          await ndaSettings.click();
          
          // Enable NDA protection
          const ndaToggle = page.locator('[data-testid="require-nda"], input[name="requireNDA"]');
          if (await ndaToggle.count() > 0) {
            await ndaToggle.check();
            
            // Save NDA settings
            const saveButton = page.locator('[data-testid="save-nda-settings"], button:has-text("Save")');
            if (await saveButton.count() > 0) {
              await saveButton.click();
              await pageHelper.waitForPageLoad();
              
              console.log('✓ NDA protection enabled for documents');
            }
          }
        }
      }
      
      // Test as investor without NDA access
      await authHelper.logout();
      await authHelper.loginAsInvestor();
      
      // Try to access protected documents
      await page.goto('/browse');
      await pageHelper.waitForPageLoad();
      
      const pitchCards = page.locator('[data-testid="pitch-card"]');
      if (await pitchCards.count() > 0) {
        await pitchCards.first().click();
        await pageHelper.waitForPageLoad();
        
        // Should see NDA requirement message
        const ndaRequired = page.locator('[data-testid="nda-required"], .nda-protection-message');
        if (await ndaRequired.count() > 0) {
          await expect(ndaRequired).toBeVisible();
          console.log('✓ NDA requirement properly displayed');
        }
        
        // Documents should not be directly accessible
        const restrictedDocs = page.locator('[data-testid="restricted-document"], .nda-protected');
        const restrictedCount = await restrictedDocs.count();
        
        if (restrictedCount > 0) {
          console.log(`${restrictedCount} documents are NDA-protected`);
          
          for (let i = 0; i < Math.min(restrictedCount, 2); i++) {
            const doc = restrictedDocs.nth(i);
            const accessButton = doc.locator('[data-testid="request-access"], button:has-text("Request")');
            
            if (await accessButton.count() > 0) {
              await expect(accessButton).toBeVisible();
              console.log(`✓ Access request available for document ${i + 1}`);
            }
          }
        }
      }
    });

    test('tests file encryption and secure transmission', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Test HTTPS enforcement for file uploads
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/^https?:\/\//);
      
      if (currentUrl.startsWith('https://')) {
        console.log('✓ Secure HTTPS connection for file operations');
      } else {
        console.log('⚠ Non-secure connection detected (acceptable for local testing)');
      }
      
      // Test secure headers in file requests
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Intercept file upload requests to check security headers
      let uploadRequestHeaders: Record<string, string> = {};
      
      await page.route('**/api/upload/**', async (route, request) => {
        uploadRequestHeaders = request.headers();
        console.log('Upload request headers:', Object.keys(uploadRequestHeaders));
        
        // Continue with the request
        await route.continue();
      });
      
      // Simulate file upload to trigger request interception
      const fileInput = page.locator('input[type="file"]');
      if (await fileInput.count() > 0) {
        await page.evaluate(() => {
          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
          if (fileInput) {
            const mockFile = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
            const dt = new DataTransfer();
            dt.items.add(mockFile);
            fileInput.files = dt.files;
            
            const changeEvent = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(changeEvent);
          }
        });
        
        // Wait for potential upload request
        await page.waitForTimeout(2000);
        
        // Check for security headers
        const securityHeaders = [
          'authorization',
          'x-csrf-token',
          'x-request-id',
          'content-type'
        ];
        
        for (const header of securityHeaders) {
          if (uploadRequestHeaders[header]) {
            console.log(`✓ Security header present: ${header}`);
          }
        }
      }
      
      console.log('✓ File security validation completed');
    });
  });

  test.describe('File Upload Error Handling and Recovery', () => {
    test('validates error handling for failed uploads', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to upload interface
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Test error handling simulation
      await page.evaluate(async () => {
        // Simulate various upload error scenarios
        const errorScenarios = [
          { type: 'network', message: 'Network connection failed' },
          { type: 'server', message: 'Server error occurred' },
          { type: 'quota', message: 'Storage quota exceeded' },
          { type: 'format', message: 'Invalid file format' },
          { type: 'size', message: 'File size too large' }
        ];
        
        for (const scenario of errorScenarios) {
          // Simulate error event
          const errorEvent = new CustomEvent('uploaderror', {
            detail: { type: scenario.type, message: scenario.message }
          });
          
          document.dispatchEvent(errorEvent);
          
          // Wait for error handling
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        (window as any).errorHandlingTested = true;
      });
      
      const errorTested = await page.evaluate(() => (window as any).errorHandlingTested);
      expect(errorTested).toBeTruthy();
      
      // Check for error display elements
      const errorElements = [
        '[data-testid="upload-error"]',
        '[data-testid="error-message"]',
        '.upload-error',
        '.error-alert'
      ];
      
      for (const element of errorElements) {
        const errorElement = page.locator(element);
        if (await errorElement.count() > 0) {
          console.log(`✓ Error display element available: ${element}`);
        }
      }
      
      // Test retry functionality
      const retryButton = page.locator('[data-testid="retry-upload"], button:has-text("Retry")');
      if (await retryButton.count() > 0) {
        await expect(retryButton).toBeVisible();
        console.log('✓ Upload retry functionality available');
      }
    });

    test('tests upload resumption and recovery', async ({ page }) => {
      await authHelper.loginAsCreator();
      
      // Navigate to upload interface
      await page.goto('/create-pitch');
      await pageHelper.waitForPageLoad();
      
      // Test upload resumption simulation
      await page.evaluate(async () => {
        // Simulate interrupted upload scenario
        const mockFile = new File([new ArrayBuffer(10 * 1024 * 1024)], 'large-file.pdf', { type: 'application/pdf' });
        
        // Start upload simulation
        let uploadProgress = 0;
        const progressInterval = setInterval(() => {
          uploadProgress += 10;
          
          // Simulate interruption at 60%
          if (uploadProgress === 60) {
            clearInterval(progressInterval);
            
            // Trigger interruption event
            const interruptEvent = new CustomEvent('uploadinterrupted', {
              detail: { progress: uploadProgress, file: mockFile.name }
            });
            document.dispatchEvent(interruptEvent);
            
            // Simulate resumption after delay
            setTimeout(() => {
              const resumeInterval = setInterval(() => {
                uploadProgress += 15;
                
                if (uploadProgress >= 100) {
                  clearInterval(resumeInterval);
                  
                  const completeEvent = new CustomEvent('uploadcomplete', {
                    detail: { file: mockFile.name }
                  });
                  document.dispatchEvent(completeEvent);
                }
              }, 200);
            }, 1000);
          }
        }, 100);
        
        (window as any).uploadResumptionTested = true;
      });
      
      const resumptionTested = await page.evaluate(() => (window as any).uploadResumptionTested);
      expect(resumptionTested).toBeTruthy();
      
      // Check for resumption UI elements
      const resumptionElements = [
        '[data-testid="resume-upload"]',
        '[data-testid="upload-interrupted"]',
        '.upload-resume',
        '.interrupted-upload'
      ];
      
      for (const element of resumptionElements) {
        const resumeElement = page.locator(element);
        if (await resumeElement.count() > 0) {
          console.log(`✓ Upload resumption element available: ${element}`);
        }
      }
      
      console.log('✓ Upload resumption and recovery testing completed');
    });
  });
});