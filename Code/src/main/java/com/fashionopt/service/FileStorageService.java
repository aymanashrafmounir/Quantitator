package com.fashionopt.service;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
public class FileStorageService {

    public Path storeFile(MultipartFile file) throws IOException {
        Path tempDir = Files.createTempDirectory("fashionopt");
        Path filePath = tempDir.resolve(file.getOriginalFilename());
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        return filePath;
    }
}