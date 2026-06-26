import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import user from "../models/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const usersFile = path.join(currentDirectory, "..", "data", "users.json");

const isMongoConnected = () => mongoose.connection.readyState === 1;

const readLocalUsers = async () => {
  try {
    const content = await fs.readFile(usersFile, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
};

const writeLocalUsers = async (users) => {
  await fs.mkdir(path.dirname(usersFile), { recursive: true });
  await fs.writeFile(usersFile, JSON.stringify(users, null, 2));
};

const withoutPassword = (currentUser) => {
  const userData =
    typeof currentUser.toObject === "function"
      ? currentUser.toObject()
      : { ...currentUser };

  delete userData.password;
  return userData;
};

const createToken = (currentUser) =>
  jwt.sign(
    { email: currentUser.email, id: currentUser._id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

export const Signup = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (isMongoConnected()) {
      const exisitinguser = await user.findOne({ email });
      if (exisitinguser) {
        return res.status(409).json({ message: "User already exists" });
      }

      const hashpassword = await bcrypt.hash(password, 12);
      const newuser = await user.create({
        name,
        email,
        password: hashpassword,
      });

      return res
        .status(201)
        .json({ data: withoutPassword(newuser), token: createToken(newuser) });
    }

    const users = await readLocalUsers();
    const exisitinguser = users.find(
      (currentUser) => currentUser.email.toLowerCase() === email.toLowerCase()
    );

    if (exisitinguser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const newuser = {
      _id: randomUUID(),
      name,
      email,
      password: await bcrypt.hash(password, 12),
      about: "",
      tags: [],
      joinDate: new Date().toISOString(),
    };

    users.push(newuser);
    await writeLocalUsers(users);

    return res
      .status(201)
      .json({ data: withoutPassword(newuser), token: createToken(newuser) });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
    return;
  }
};

export const Login = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (isMongoConnected()) {
      const exisitinguser = await user.findOne({ email });
      if (!exisitinguser) {
        return res.status(404).json({ message: "User does not exist" });
      }

      const ispasswordcrct = await bcrypt.compare(
        password,
        exisitinguser.password
      );
      if (!ispasswordcrct) {
        return res.status(400).json({ message: "Invalid password" });
      }

      return res.status(200).json({
        data: withoutPassword(exisitinguser),
        token: createToken(exisitinguser),
      });
    }

    const users = await readLocalUsers();
    const exisitinguser = users.find(
      (currentUser) => currentUser.email.toLowerCase() === email.toLowerCase()
    );

    if (!exisitinguser) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const ispasswordcrct = await bcrypt.compare(
      password,
      exisitinguser.password
    );
    if (!ispasswordcrct) {
      return res.status(400).json({ message: "Invalid password" });
    }

    return res.status(200).json({
      data: withoutPassword(exisitinguser),
      token: createToken(exisitinguser),
    });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
    return;
  }
};

export const getallusers = async (req, res) => {
  try {
    if (isMongoConnected()) {
      const alluser = await user.find();
      return res.status(200).json({ data: alluser.map(withoutPassword) });
    }

    const alluser = await readLocalUsers();
    return res.status(200).json({ data: alluser.map(withoutPassword) });
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
    return;
  }
};

export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { name, about, tags } = req.body.editForm;

  if (isMongoConnected()) {
    if (!mongoose.Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ message: "User unavailable" });
    }

    try {
      const updateprofile = await user.findByIdAndUpdate(
        _id,
        { $set: { name: name, about: about, tags: tags } },
        { new: true }
      );
      res.status(200).json({ data: withoutPassword(updateprofile) });
    } catch (error) {
      console.log(error);
      res.status(500).json({ message: "Something went wrong" });
      return;
    }

    return;
  }

  try {
    const users = await readLocalUsers();
    const userIndex = users.findIndex((currentUser) => currentUser._id === _id);

    if (userIndex === -1) {
      return res.status(400).json({ message: "User unavailable" });
    }

    users[userIndex] = {
      ...users[userIndex],
      name,
      about,
      tags,
    };

    await writeLocalUsers(users);
    res.status(200).json({ data: withoutPassword(users[userIndex]) });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Something went wrong" });
    return;
  }
};
