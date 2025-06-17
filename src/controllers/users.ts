import { MT5Account, User } from '../types/interfaces.js';
import { auth, firestore } from '../configs/firebase.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Request, Response, NextFunction } from 'express';
import { sendVerificationEmail, sendWelcomeEmail } from '../utils/sendEmails.js';

// Create User
export const createUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password, subscription } = req.body;

    // Creates a user on Auth
    const userRecord = await auth.createUser({ email, password });
    const userId = userRecord.uid;

    // Initialise a MT5Accounts array
    const MT5Accounts: MT5Account[] = [];
    
    // If successful, add details to document
    const newUser: User = {
        userId, 
        name, 
        email,
        subscription,
        metaApi: {
            MT5Accounts
        }
    };

    await firestore.collection('users').doc(userId).set(newUser);

    // Putting this on hold for now whilst we get this sorted
    // Send verification email 
    // await sendVerificationEmail(req, next);


    res.status(201).json({
        success: true, 
        message: 'User successfully created',
        data: { userId }
    });
});

// Fetch User profile
export const getUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    // Fetch UserRecord on Auth
    const userRecord = await auth.getUser(user.uid);

    // Fetch User document on Firestore
    const userDoc = (await firestore.collection('users').doc(user.uid).get()).data();

    // Would not be necessary, but would be okay to have in code
    if (!userDoc) {
        res.status(404).json({
            success: false, 
            message: 'User document not found in database'
        });

        return;
    }

    // Construct return data
    const data: any = {
        // Auth data
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        creationTime: userRecord.metadata.creationTime,
        lastSignInTime: userRecord.metadata.lastSignInTime,
        // Firestore custom data
        name: userDoc.name,
        subscription: userDoc.subscription
    }

    // Add photoURL if it exists 
    if (userDoc.photo) {
        data.photo = userDoc.photo
    };

    res.status(200).json({
        success: true,
        message: 'User profile retrieved successfully',
        data: data
    });
});

// Update email
export const updateEmail = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { newEmail } = req.body; 

    // Update on Auth
    await auth.updateUser(user.uid, {
        email: newEmail
    });

    // Update on firestore
    await firestore.collection('users').doc(user.uid).update({ email: newEmail });

    res.status(200).json({
        success: true, 
        message: 'Email updated successfully'
    });
});

// Update password
export const updatePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { newPassword } = req.body; 

    // Update in Auth
    await auth.updateUser(user.uid, {
        password: newPassword
    });

    res.status(200).json({
        success: true, 
        message: 'Password updated successfully'
    });
});

// Update name
export const updateName = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { newName } = req.body; 
    
    // Only updating on Firestore
    await firestore.collection('users').doc(user.uid).update({ name: newName });

    res.status(200).json({
        success: true, 
        message: 'Name updated successfully'
    });
});

// Update subscription 
export const updateSubscription = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { newSubscription } = req.body; 
    
    // Only updating on Firestore
    await firestore.collection('users').doc(user.uid).update({ subscription: newSubscription });

    res.status(200).json({
        success: true, 
        message: 'Subscription updated successfully'
    });
});

// Delete User 
export const deleteUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    // Delete user on Auth 
    await auth.deleteUser(user.uid);

    // Delete User from Firestore
    await firestore.collection('users').doc(user.uid).delete();

    res.status(200).json({
        success: true, 
        message: 'User deleted successfully'
    });
});

// Send Welcome Email 
export const userVerified = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    await sendWelcomeEmail(req, res, next);

    // Note that we don't need to send a message that we have verified succesfully
    // Just implementing this function to send welcome email
    res.status(200).json({
        success: true,
        message: 'User verified successfully'
    })
})

// Update Photo
export const updatePhoto = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    const { newPhoto } = req.body;

    // Update the "photo" property on database
    await firestore.collection('users').doc(user.uid).set({ photo: newPhoto }, {merge: true });

    // Return success 
    res.status(200).json({
        success: true, 
        message: 'User photo updated successfully'
    });
});
