const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const Sharp = require('sharp');

//modelName is type of image uploaded for example, in future it might be userProfile, but for now it's just going to be mainImage, additionalImage

class ImageUploader {
  constructor(modelName, sizes = {}) {
    (this.modelName = modelName),
      (this.sizes = sizes),
      (this.config = {
        //current version of amazon S3 API (see: https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html)
        apiVersion: '2006-03-01',
        region: process.env.S3_REGION,
        credentials: {
          accessKeyId: process.env.S3_KEY_ID,
          secretAccessKey: process.env.S3_SECRET
        }
      }),
      (this.s3 = new S3Client(this.config));
  }
  //method to predefine path for uploaded items based on input params
  dir(id) {
    return `garment_item_id${id}/${this.modelName}`;
  }

  //The MAIN IMAGE should NOT be deleted without a replacement being added
  //TODO:  INCORPORATE DELETION INTO POSTING OF MAIN IMAGE
  //HOW TO PROVIDE CORRECT KEY TO DELETE TO S3?  GET FILENAME FROM PG?  FROM S3?s
  //SEPARATE SECONDARY IMAGE POSTINGS INTO ANOTHER CLASS? PREVENT INHERITANCE OF DELETION?
  //SECONDARY IMAGES SHOULD BE ABLE TO BE DELETED WITHOUT REPLACEMENT
  //THE MAIN IMAGE TABLE & RESIZED MAIN IMAGES TABLE HAVE BEEN CONSOLIDATED. For the time being, refactoring the function in the images router file allowed the original and resized versions of the main image to all be uploaded and urls saved to the db.

  //method to delete the original (unaltered) version of the image uploaded
  // async deleteOriginalImage(id, file_name) {
  //   const Bucket = process.env.S3_BUCKET_NAME;
  //   //will the simple return await with a .promise.catch eliminate need for try/catch block?
  //   return await this.s3
  //     .deleteObject({ Bucket, Key: `${this.dir(id)}/${file_name}` })
  //     .promise()
  //     .catch((err) =>
  //       console.log(
  //         `Error deleting image at path: ${this.dir(
  //           id
  //         )}/${file_name}`,
  //         err
  //       )
  //     );
  // }

  //method to be used by classes which include resizing imagages, to delete all different sizes, depending on class
  async deleteResizedImages(id, file_name) {
    const Bucket = process.env.S3_BUCKET_NAME;
    //switch if statement to nest inside try block
    try {
      if (this.sizes) {
        const names = Object.keys(this.sizes);
        for (const name of names) {
          const command = new DeleteObjectCommand({
            Bucket,
            Key: `${this.dir(id)}/${name}_${file_name}`
          });

          try {
            await this.s3.send(command);
          } catch (err) {
            console.error(
              `Error deleting resized versions of image with filename "${file_name}".`,
              err
            );
          }
        }
      }
    } catch (err) {
      console.error(
        `Error deleting resized versions of image with filename "${file_name}".  Message: `,
        err
      );
    }
  }

  //upload image in the largest original size available
  //TODO: limit maximum size
  async uploadOriginalImage(id, file_name, body, content_type, md5) {
    const Bucket = process.env.S3_BUCKET_NAME;
    try {
      const command = new PutObjectCommand({
        Bucket,
        Body: body,
        Key: `${this.dir(id)}/${file_name}`,
        ContentType: content_type,
        ContentMD5: md5,
        ACL: 'public-read'
      });

      const data = await this.s3.send(command);

      console.log(
        'Original image uploaded successfully. ETag: ',
        data.ETag
      );
      const url = `http://${Bucket}.s3.${
        process.env.S3_REGION
      }.amazonaws.com/${this.dir(id)}/${file_name}`;
      console.log(`URL: ${url}`);
      return url;
    } catch (err) {
      console.error(
        `Error uploading original file "${file_name}". Message: `,
        err
      );
    } // TO DO: use delete function in catch block
  }

  //method to upload resized images (resized with Sharp)
  async uploadResizedImages(id, file_name, body, content_type) {
    const Bucket = process.env.S3_BUCKET_NAME;
    let baseUrl;

    try {
      if (this.sizes) {
        const names = Object.keys(this.sizes);
        for (const name of names) {
          const [width, height] = this.sizes[name];
          const fitType = name === 'display' ? 'cover' : 'contain';
          const sizedBody = await Sharp(body)
            .resize(width, height, {
              fit: fitType,
              background: { r: 255, g: 255, b: 255, alpha: 1 }
            })
            .toBuffer();

          const command = new PutObjectCommand({
            Bucket,
            Body: sizedBody,
            Key: `${this.dir(id)}/${name}_${file_name}`,
            ContentType: content_type,
            ACL: 'public-read'
          });
          await this.s3.send(command);

          console.log(
            `Resized version "${name}" of image was uploaded successfully.`
          );
        }

        baseUrl = `http://${Bucket}.s3.${
          process.env.S3_REGION
        }.amazonaws.com/${this.dir(id)}`;
      }
      return baseUrl;
    } catch (err) {
      console.error(
        `Error uploading resized versions of image with filename "${file_name}".  Message: `,
        err
      );
    }
  }
  //end methods
}
//End 'parent' class

class ResizedMainImageUploader extends ImageUploader {
  constructor(modelName) {
    super(modelName, {
      large: [500, 609],
      display: [400, 600], //for search view
      admin_upload: [250, 305], //for upload page
      small: [96, 117],
      thumb: [64, 78]
    });
  }
}

class SecondaryImagesUploader extends ImageUploader {
  constructor(modelName) {
    super(modelName, {
      large: [500, 609],
      small: [96, 117],
      thumb: [64, 78]
    });
  }
}

module.exports = {
  ImageUploader,
  ResizedMainImageUploader,
  SecondaryImagesUploader
};
