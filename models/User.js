import mongoose from "mongoose";

// A LetsMeet user, created/updated from a Google sign-in. Mirrors the fields
// NextAuth gives us (name, email, image) plus the stable Google account id.
// No password field — Google OAuth is the only way in, by design.
const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: { type: String },
  },
  { timestamps: true }
);

// Guard against model re-compilation on hot reload / repeated imports.
export default mongoose.models.User || mongoose.model("User", UserSchema);
