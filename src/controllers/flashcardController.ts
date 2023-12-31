import { Request, Response } from "express";
import * as flashcardService from "../services/flashcardService";
import { Category, Flashcard, Marathon } from "../types/flashcardInterfaces";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { User } from "../types/flashcardInterfaces";
import { RequestWithUserPayload } from "../types/request.interface";
import {
  getCategoryByFlashcardId,
  deleteCategory,
  getCategoryRowCount,
  getCategories,
  createFlashcard,
  deleteFlashcardById,
  getFlashcardbyId,
  getFlashcards,
  updateFlashcardbyId,
  checkCategoryExists,
  addCategory,
  createQuizRecord,
  updateFlashCards,
  getMarathons,
  createMarathonRecord,
  getCurrentMarathonQuiz,
  getMarathonById,
  updateMarathonbyId,
  updateQuizRecord,
} from "../services/flashcardService";
import { start } from "repl";
export default {

  getFlashcards: async (req: RequestWithUserPayload, res: Response) => {
    try {
      const category = req.query.category as string | undefined;
      const difficulty_level = req.query.difficulty_level as string | undefined;
      const username = req.user?.username;

      if (!username) {
        return res
          .status(500)
          .json({ error: "Internal server error, user not found" });
      }

      const flashcards: Flashcard[] = await getFlashcards(
        username,
        category,
        difficulty_level
      );
      res.json(flashcards);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
  getFlashcard: async (req: RequestWithUserPayload, res: Response) => {
    try {
      const { cardId } = req.params;
      const flashcard = await getFlashcardbyId(cardId);
      if (!flashcard) {
        return res.status(404).json({ error: "Flashcard not found" });
      }
      res.json(flashcard);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
  deleteFlashcard: async (req: RequestWithUserPayload, res: Response) => {
    try {
      if (req.user) {
        const username = req.user.username;
        const { cardId } = req.params;
        const category = await getCategoryByFlashcardId(cardId);
        const rowCount = await getCategoryRowCount(username, category);
        if (rowCount == 1) {
          await deleteCategory(username, category);
        }
        await deleteFlashcardById(cardId);
        res.json({
          message: `Flashcard with ID ${cardId} deleted successfully`,
        });
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
  createFlashcard: async (req: RequestWithUserPayload, res: Response) => {
    try {
      if (req.user) {
        const id = uuidv4();
        const username = req.user.username;
        const {
          question: question,
          answer: answer,
          category: category,
          difficulty_level: difficulty_level,
          is_auto: is_auto,
        } = req.body;

        const categoryC = category.charAt(0).toUpperCase() + category.slice(1);
        const newFlashcard: Flashcard = {
          id: id,
          username: username,
          question: question,
          answer: answer,
          category: categoryC,
          difficulty_level: difficulty_level,
          is_auto: is_auto,
        };
        const category_exist: boolean = await checkCategoryExists(
          username,
          categoryC
        );
        if (!category_exist) {
          await addCategory(username, categoryC);
        }
        await createFlashcard(newFlashcard);
        res.status(201).json(newFlashcard);
      }
    } catch (error) {
      res.status(400).json({ error: "Invalid data" });
    }
  },
  updateFlashcard: async (req: RequestWithUserPayload, res: Response) => {
    try {
      if (req.user) {
        const username = req.user?.username;
        const { cardId } = req.params;
        const updatedFields: Partial<Flashcard> = req.body;
        const is_auto = updatedFields?.is_auto;
        const category = updatedFields?.category;
        const previous_category = await getCategoryByFlashcardId(cardId);
        const rowCount = await getCategoryRowCount(username, previous_category);
        if (rowCount == 1) {
          await deleteCategory(username, previous_category);
        }
        if (category) {
          const category_exist: boolean = await checkCategoryExists(
            username,
            category
          );
          if (!category_exist) {
            await addCategory(username, category);
          }
          await updateFlashcardbyId(cardId, updatedFields);
          const updatedFlashcard = await getFlashcardbyId(cardId);
          if (!updatedFlashcard) {
            return res.status(404).json({ error: "Flashcard not found" });
          }
          res.json(updatedFlashcard);
        } else {
          return res.status(404).json({ error: "Flashcard is not Auto" });
        }
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },
  submitQuiz: async (req: RequestWithUserPayload, res: Response) => {
    try {
      if (req.user) {
        const id = uuidv4();
        const username = req.user.username;
        let {
          flashcards,
          quiz_id,
          start_time,
          end_time,
          marathon_or_practice,
          marathon_id,
        } = req.body;

        const updateFlashcardsPromise = await updateFlashCards(flashcards);

        let updateQuizzesPromise;
        if (marathon_or_practice === "marathon") {
          const existingMarathon = await getMarathonById(marathon_id, quiz_id);

          if (existingMarathon) {
            await updateMarathonbyId(
              existingMarathon.marathon_id,
              existingMarathon.quiz_id,
              {
                did_quiz: 1,
              }
            );

            updateQuizzesPromise = Promise.all(
              flashcards.map(async (flashcard: Flashcard) => {
                const { id: flashcardId, difficulty_level, category } = flashcard;
                return updateQuizRecord(
                  quiz_id,
                  flashcardId,
                  username,
                  difficulty_level,
                  category,
                  start_time,
                  end_time
                );
              })
            );
          } else {
            console.error("Marathon not found for update.");
          }
        } else {
          updateQuizzesPromise = Promise.all(
            flashcards.map(async (flashcard: Flashcard) => {
              const { id: flashcardId, difficulty_level, category } = flashcard;
              return createQuizRecord(
                id,
                flashcardId,
                username,
                difficulty_level,
                category,
                start_time,
                end_time
              );
            })
          );
        }
        res.status(200).json({ message: "Quiz submitted successfully" });
      } else {
        res.status(401).json({ error: "Unauthorized" });
      }
    } catch (error) {
      console.error("Error submitting quiz:", error);
      res.status(400).json({ error: "Invalid data" });
    }
  },

  getCategories: async (req: RequestWithUserPayload, res: Response) => {
    try {
      const username = req.user?.username;
      if (username) {
        const categories: Category | {} = await getCategories(username);
        if (!categories) {
          return res.status(404).json({ error: "Flashcard not found" });
        }
        res.json(categories);
      }
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  getStats: async (req: RequestWithUserPayload, res: Response) => {
    const username = req.user?.username;
    try {
      const stats = [];

      let stat1 = await flashcardService.getStats1(username);
      stats.push(stat1);
      let stat2 = await flashcardService.getStats2(username);
      stats.push(stat2);
      let stat3 = await flashcardService.getStats3(username);
      stats.push(stat3);
      let stat4 = await flashcardService.getStats4(username);
      stats.push(stat4);
      let stat5 = await flashcardService.getStats5(username);
      stats.push(stat5);
      let stat6 = await flashcardService.getStats6(username);
      stats.push(stat6);
      let stat7 = await flashcardService.getStats7(username);
      stats.push(stat7);
      res.status(200).json(stats);
    } catch (error) {
      console.error("Error generating stats:", error);
      res.status(500).json({ error: "Failed to generate stats" });
    }
  },

  getQuizzes: async (req: RequestWithUserPayload, res: Response) => {
    let { categories, selectedNumberOfQuestionsPerQuiz } = req.body;
    const username = req.user?.username;
    if (
      !selectedNumberOfQuestionsPerQuiz ||
      selectedNumberOfQuestionsPerQuiz == 0 ||
      selectedNumberOfQuestionsPerQuiz == "undefined"
    ) {
      selectedNumberOfQuestionsPerQuiz = 3;
    } else if (selectedNumberOfQuestionsPerQuiz < 3) {
      res.status(400).json({
        error: `Cannot generate a quiz with under 3 flashcards`,
      });
      return;
    }
    try {
      const quizzes = [];

      for (let i = 0; i < categories.length; i++) {
        const selectedFlashcards = await getFlashcards(username, categories[i]);
        const usedMap: number[] = new Array(selectedFlashcards.length).fill(0);
        if (selectedFlashcards.length < selectedNumberOfQuestionsPerQuiz) {
          res.status(400).json({
            error: `Category '${categories[i]}' doesn't have enough flashcards to generate quizzes, either below 3 or lower than requested number of questions per quiz`,
          });
          return;
        }

        const numFlashcards = selectedFlashcards.length;
        for (
          let j = 0;
          j < Math.floor(numFlashcards / selectedNumberOfQuestionsPerQuiz);
          j += 1
        ) {
          const selectedIndices = new Set<number>();
          const selectedDifficultyLevels = new Set<string>();
          let randomIndex = Math.floor(
            Math.random() * selectedFlashcards.length
          );
          while (selectedIndices.size < selectedNumberOfQuestionsPerQuiz) {
            while (usedMap[randomIndex] === 1) {
              randomIndex = Math.floor(
                Math.random() * selectedFlashcards.length
              );
            }
            usedMap[randomIndex] += 1;
            if (!selectedIndices.has(randomIndex)) {
              selectedIndices.add(randomIndex);
              selectedDifficultyLevels.add(
                selectedFlashcards[randomIndex].difficulty_level
              );
            }
          }

          const selectedDifficultyLevelsArray = Array.from(
            selectedDifficultyLevels
          ).sort((a, b) => {
            const difficultyOrder = ["Easy", "Medium", "Hard"];
            return difficultyOrder.indexOf(a) - difficultyOrder.indexOf(b);
          });

          const selectedFlashcardIndices: number[] =
            Array.from(selectedIndices);

          const selectedFlashcardsForQuiz: Flashcard[] =
            selectedFlashcardIndices.map(
              (index: number) => selectedFlashcards[index]
            );

          const quiz = {
            id: `Quiz_${i + 1}`,
            title: `Quiz ${i + 1}`,
            categories: [categories[i]],
            flashcards: selectedFlashcardsForQuiz,
            difficulty_levels: selectedDifficultyLevelsArray,
          };

          quizzes.push(quiz);
        }
      }
      res.status(200).json(quizzes);
    } catch (error) {
      console.error("Error generating quizzes:", error);
      res.status(500).json({ error: "Failed to generate quizzes" });
    }
  },

  generateMarathon: async (req: RequestWithUserPayload, res: Response) => {
    let { category, total_days, num_questions, num_quiz } = req.body;
    const username = req.user?.username;
    num_quiz = num_quiz == undefined ? 1 : num_quiz;
    if (!username) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const allFlashcardsInCategory = await getFlashcards(username, category);
    num_questions =
      num_questions == undefined
        ? Math.floor(allFlashcardsInCategory.length / (total_days * num_quiz))
        : num_questions;
    num_questions = num_questions < 3 ? 3 : num_questions;
    const usedMap: number[] = new Array(allFlashcardsInCategory.length).fill(0);
    const numOfFlashcardsPerQuiz = num_questions;
    if (
      allFlashcardsInCategory.length < num_questions ||
      allFlashcardsInCategory.length < 3
    ) {
      res.status(400).json({
        error: `${category}' doesn't have enough flashcards for a single quiz`,
      });
      return;
    }
    try {
      const startDate = new Date();
      const curMarathonUUID = uuidv4();
      for (let i = 0; i < total_days; i++) {
        for (let k = 0; k < num_quiz; k++) {
          const curQuizUUID = uuidv4();

          const curQuiz: any = {
            physical_id: curQuizUUID,
            title: `Quiz - Day ${i + 1}`,
            categories: [category],
            flashcards: [],
            difficulty_levels: ["Easy", "Medium", "Hard"],
          };

          for (let j = 0; j < numOfFlashcardsPerQuiz; j++) {
            let randomIndex = Math.floor(
              Math.random() * allFlashcardsInCategory.length
            );

            while (
              usedMap[randomIndex] === 1 ||
              curQuiz.flashcards.includes(allFlashcardsInCategory[randomIndex])
            ) {
              randomIndex = Math.floor(
                Math.random() * allFlashcardsInCategory.length
              );
            }

            usedMap[randomIndex] = 1;
            const allUsed = usedMap.every((status) => status === 1);
            if (allUsed) {
              usedMap.fill(0);
            }
            const selectedFlashcard = allFlashcardsInCategory[randomIndex];

            await createQuizRecord(
              curQuiz.physical_id,
              selectedFlashcard.id,
              username,
              selectedFlashcard.difficulty_level,
              category
            );

            curQuiz.flashcards.push(selectedFlashcard);
          }

          await createMarathonRecord(
            curMarathonUUID,
            curQuizUUID,
            username,
            category,
            i,
            total_days,
            startDate,
            0
          );
        }
      }

      res.status(200).json(curMarathonUUID);
    } catch (error) {
      console.error("Error generating Marathon:", error);
      res.status(500).json({ error: "Failed to generate Marathon" });
    }
  },

  getMarathons: async (req: RequestWithUserPayload, res: Response) => {
    try {
      const username = req.user?.username;

      if (!username) {
        return res
          .status(500)
          .json({ error: "Internal server error, user not found" });
      }

      const marathons: Marathon[] = await getMarathons(username);

      res.json(marathons);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  },

  loginPage: async (req: Request, res: Response) => {
    const { username, password } = req.body;

    const isValidUser: User = await flashcardService.validateUser(
      username,
      password
    );

    if (isValidUser) {
      const tokenPayload = {
        username: username,
        fname: isValidUser.fname,
      };
      const token = jwt.sign(tokenPayload, "secret_key");
      res.status(200).json({ token });
    } else {
      res.status(403).json({ error: "Invalid credentials" });
    }
  },
  registerUser: async (req: Request, res: Response) => {
    const { username, password, fname, lname } = req.body;
    const userExists: boolean = await flashcardService.userExists(username);
    if (!userExists) {
      const isRegistered = await flashcardService.registerUser(
        username,
        password,
        fname,
        lname
      );
      if (!isRegistered) {
        res
          .status(500)
          .json({ error: "Error when signing up, please try again" });
      } else {
        res.status(201).json({ message: "User created successfully." });
      }
    } else {
      res.status(400).json({ error: "User already exists" });
    }
  },
  getCurrentMarathonQuiz: async (
    req: RequestWithUserPayload,
    res: Response
  ) => {
    try {
      const { marathon_id } = req.body;
      const quiz = await getCurrentMarathonQuiz(marathon_id);
      res.status(200).json(quiz);
    } catch (error) {
      console.error("Error fetching current marathon quiz:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
};
