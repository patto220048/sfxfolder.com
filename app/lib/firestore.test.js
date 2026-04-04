import { addResource } from './firestore';
import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

jest.mock('./firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'mocked-timestamp')
}));

describe('Firestore API - Resources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('addResource adds a document to resources collection', async () => {
    const mockDocRef = { id: 'test-id' };
    addDoc.mockResolvedValue(mockDocRef);
    collection.mockReturnValue('mocked-collection');

    const resourceData = {
      name: 'Test Resource',
      category: 'Test Category',
      downloadUrl: 'https://test.com'
    };

    const result = await addResource(resourceData);

    expect(collection).toHaveBeenCalledWith(db, 'resources');
    expect(addDoc).toHaveBeenCalledWith('mocked-collection', {
      ...resourceData,
      downloadCount: 0,
      isPublished: true,
      createdAt: 'mocked-timestamp',
      updatedAt: 'mocked-timestamp'
    });
    expect(result.id).toBe('test-id');
  });
});
