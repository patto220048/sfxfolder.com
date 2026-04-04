import { uploadFile } from './storage';
import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

jest.mock('./firebase', () => ({
  storage: {}
}));

jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytesResumable: jest.fn(),
  getDownloadURL: jest.fn()
}));

describe('Storage API - Upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploadFile uploads a file and returns the download URL', async () => {
    const mockRef = { fullPath: 'mocked-path' };
    ref.mockReturnValue(mockRef);
    
    // uploadBytesResumable returns an uploadTask
    const mockUploadTask = {
      on: jest.fn((event, progress, error, complete) => {
        complete();
      }),
      snapshot: { ref: mockRef }
    };
    uploadBytesResumable.mockReturnValue(mockUploadTask);

    getDownloadURL.mockResolvedValue('https://mocked-url.com/file');

    const file = { name: 'test.png', type: 'image/png' };
    const url = await uploadFile(file, 'resources/test/test.png');

    expect(ref).toHaveBeenCalledWith(storage, 'resources/test/test.png');
    expect(uploadBytesResumable).toHaveBeenCalledWith(mockRef, file);
    expect(getDownloadURL).toHaveBeenCalledWith(mockRef);
    expect(url).toBe('https://mocked-url.com/file');
  });
});
