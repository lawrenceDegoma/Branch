"""Evaluation cases: typical solutions with their known complexity.

Each case records what a careful reviewer would say, and the confidence the analyzer should have.
A case the rules get wrong on purpose (a known limit) says so, so a future improvement shows up as
a deliberate change here rather than a silent one.
"""

import textwrap

import pytest

from branch_analyzer import analyze


def estimate(code: str):
    result = analyze("python3", textwrap.dedent(code))
    assert result is not None
    return result


CASES = [
    (
        "contains duplicate, hash set",
        """
        class Solution:
            def hasDuplicate(self, nums: List[int]) -> bool:
                seen = set()
                for n in nums:
                    if n in seen:
                        return True
                    seen.add(n)
                return False
        """,
        "O(n)", "O(n)", "high",
    ),
    (
        "contains duplicate, set length",
        """
        class Solution:
            def hasDuplicate(self, nums):
                return len(set(nums)) < len(nums)
        """,
        "O(n)", "O(1)", "high",  # the set isn't kept in a variable, so its space isn't seen
    ),
    (
        "two sum, brute force",
        """
        class Solution:
            def twoSum(self, nums, target):
                for i in range(len(nums)):
                    for j in range(i + 1, len(nums)):
                        if nums[i] + nums[j] == target:
                            return [i, j]
        """,
        "O(n²)", "O(1)", "high",
    ),
    (
        "two sum, hash map",
        """
        class Solution:
            def twoSum(self, nums, target):
                index = {}
                for i, n in enumerate(nums):
                    if target - n in index:
                        return [index[target - n], i]
                    index[n] = i
        """,
        "O(n)", "O(n)", "high",
    ),
    (
        "valid anagram, sorting",
        """
        class Solution:
            def isAnagram(self, s, t):
                return sorted(s) == sorted(t)
        """,
        "O(n log n)", "O(n)", "high",  # sorted() makes copies
    ),
    (
        "valid anagram, counting into a fixed array",
        """
        class Solution:
            def isAnagram(self, s, t):
                if len(s) != len(t):
                    return False
                count = [0] * 26
                for i in range(len(s)):
                    count[ord(s[i]) - ord('a')] += 1
                    count[ord(t[i]) - ord('a')] -= 1
                return all(c == 0 for c in count)
        """,
        "O(n)", "O(1)", "high",
    ),
    (
        "group anagrams: sorting each word (k log k per word, counted as n)",
        """
        class Solution:
            def groupAnagrams(self, strs):
                groups = defaultdict(list)
                for s in strs:
                    groups[tuple(sorted(s))].append(s)
                return list(groups.values())
        """,
        "O(n² log n)", "O(n)", "high",
    ),
    (
        "binary search",
        """
        class Solution:
            def search(self, nums, target):
                l, r = 0, len(nums) - 1
                while l <= r:
                    m = (l + r) // 2
                    if nums[m] == target:
                        return m
                    if nums[m] < target:
                        l = m + 1
                    else:
                        r = m - 1
                return -1
        """,
        "O(log n)", "O(1)", "high",
    ),
    (
        "two pointers",
        """
        class Solution:
            def isPalindrome(self, s):
                l, r = 0, len(s) - 1
                while l < r:
                    if s[l] != s[r]:
                        return False
                    l += 1
                    r -= 1
                return True
        """,
        "O(n)", "O(1)", "medium",
    ),
    (
        "sliding window",
        """
        class Solution:
            def lengthOfLongestSubstring(self, s):
                seen = set()
                l = 0
                best = 0
                for r in range(len(s)):
                    while s[r] in seen:
                        seen.remove(s[l])
                        l += 1
                    seen.add(s[r])
                    best = max(best, r - l + 1)
                return best
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "monotonic stack",
        """
        class Solution:
            def dailyTemperatures(self, temperatures):
                res = [0] * len(temperatures)
                stack = []
                for i, t in enumerate(temperatures):
                    while stack and t > stack[-1][0]:
                        _, j = stack.pop()
                        res[j] = i - j
                    stack.append((t, i))
                return res
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "top k frequent, heap",
        """
        class Solution:
            def topKFrequent(self, nums, k):
                count = Counter(nums)
                heap = []
                for n, c in count.items():
                    heapq.heappush(heap, (c, n))
                    if len(heap) > k:
                        heapq.heappop(heap)
                return [n for c, n in heap]
        """,
        "O(n log n)", "O(n)", "high",
    ),
    (
        "maximum depth of a binary tree",
        """
        class Solution:
            def maxDepth(self, root):
                if not root:
                    return 0
                return 1 + max(self.maxDepth(root.left), self.maxDepth(root.right))
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "climbing stairs, naive recursion",
        """
        class Solution:
            def climbStairs(self, n):
                def go(i):
                    if i >= n:
                        return i == n
                    return go(i + 1) + go(i + 2)
                return go(0)
        """,
        "O(2ⁿ)", "O(n)", "low",
    ),
    (
        "climbing stairs, memoized",
        """
        class Solution:
            def climbStairs(self, n):
                @cache
                def go(i):
                    if i >= n:
                        return i == n
                    return go(i + 1) + go(i + 2)
                return go(0)
        """,
        "O(n)", "O(n)", "low",
    ),
    (
        "number of islands, flood fill",
        """
        class Solution:
            def numIslands(self, grid):
                rows, cols = len(grid), len(grid[0])
                def dfs(r, c):
                    if r < 0 or c < 0 or r >= rows or c >= cols or grid[r][c] == "0":
                        return
                    grid[r][c] = "0"
                    dfs(r + 1, c)
                    dfs(r - 1, c)
                    dfs(r, c + 1)
                    dfs(r, c - 1)
                islands = 0
                for r in range(rows):
                    for c in range(cols):
                        if grid[r][c] == "1":
                            dfs(r, c)
                            islands += 1
                return islands
        """,
        "O(n²)", "O(n)", "medium",  # n is the side of the grid: rows × cols
    ),
    (
        "subsets, backtracking",
        """
        class Solution:
            def subsets(self, nums):
                res, path = [], []
                def backtrack(i):
                    if i == len(nums):
                        res.append(path[:])
                        return
                    path.append(nums[i])
                    backtrack(i + 1)
                    path.pop()
                    backtrack(i + 1)
                backtrack(0)
                return res
        """,
        "O(2ⁿ)", "O(n)", "low",
    ),
    (
        "membership in an input list inside a loop",
        """
        class Solution:
            def intersection(self, nums1, nums2):
                return [x for x in nums1 if x in nums2]
        """,
        "O(n²)", "O(1)", "medium",
    ),
    (
        "3sum: the pointers restart for each i, so it stays quadratic",
        """
        class Solution:
            def threeSum(self, nums):
                nums.sort()
                res = []
                for i in range(len(nums)):
                    l, r = i + 1, len(nums) - 1
                    while l < r:
                        total = nums[i] + nums[l] + nums[r]
                        if total < 0:
                            l += 1
                        elif total > 0:
                            r -= 1
                        else:
                            res.append([nums[i], nums[l], nums[r]])
                            l += 1
                            r -= 1
                return res
        """,
        "O(n²)", "O(n)", "medium",
    ),
    (
        "merge intervals",
        """
        class Solution:
            def merge(self, intervals):
                intervals.sort(key=lambda i: i[0])
                out = [intervals[0]]
                for start, end in intervals[1:]:
                    if start <= out[-1][1]:
                        out[-1][1] = max(out[-1][1], end)
                    else:
                        out.append([start, end])
                return out
        """,
        "O(n log n)", "O(n)", "high",
    ),
    (
        "reverse a linked list",
        """
        class Solution:
            def reverseList(self, head):
                prev, cur = None, head
                while cur:
                    nxt = cur.next
                    cur.next = prev
                    prev, cur = cur, nxt
                return prev
        """,
        "O(n)", "O(1)", "medium",
    ),
    (
        "breadth-first search",
        """
        class Solution:
            def levelOrder(self, root):
                res = []
                q = deque([root] if root else [])
                while q:
                    level = []
                    for _ in range(len(q)):
                        node = q.popleft()
                        level.append(node.val)
                        if node.left:
                            q.append(node.left)
                        if node.right:
                            q.append(node.right)
                    res.append(level)
                return res
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "slicing inside a loop",
        """
        class Solution:
            def countPalindromes(self, s):
                count = 0
                for i in range(len(s)):
                    for j in range(i + 1, len(s) + 1):
                        if s[i:j] == s[i:j][::-1]:
                            count += 1
                return count
        """,
        "O(n³)", "O(1)", "high",
    ),
    (
        "top k frequent, bucket sort",
        """
        class Solution:
            def topKFrequent(self, nums, k):
                count = {}
                freq = [[] for i in range(len(nums) + 1)]
                for n in nums:
                    count[n] = 1 + count.get(n, 0)
                for n, c in count.items():
                    freq[c].append(n)
                res = []
                for i in range(len(freq) - 1, 0, -1):
                    for n in freq[i]:
                        res.append(n)
                        if len(res) == k:
                            return res
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "course schedule, BFS over adjacency lists (n counts nodes and edges)",
        """
        class Solution:
            def canFinish(self, numCourses, prerequisites):
                adj = defaultdict(list)
                indeg = [0] * numCourses
                for a, b in prerequisites:
                    adj[b].append(a)
                    indeg[a] += 1
                q = deque([i for i in range(numCourses) if indeg[i] == 0])
                seen = 0
                while q:
                    node = q.popleft()
                    seen += 1
                    for nei in adj[node]:
                        indeg[nei] -= 1
                        if indeg[nei] == 0:
                            q.append(nei)
                return seen == numCourses
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "coin change: loops over two inputs, shown as n² with less confidence",
        """
        class Solution:
            def coinChange(self, coins, amount):
                dp = [amount + 1] * (amount + 1)
                dp[0] = 0
                for a in range(1, amount + 1):
                    for c in coins:
                        if a - c >= 0:
                            dp[a] = min(dp[a], 1 + dp[a - c])
                return dp[amount] if dp[amount] != amount + 1 else -1
        """,
        "O(n²)", "O(n)", "medium",
    ),
    (
        "longest consecutive sequence: the inner loop only runs from a sequence's start",
        """
        class Solution:
            def longestConsecutive(self, nums):
                numSet = set(nums)
                longest = 0
                for n in numSet:
                    if (n - 1) not in numSet:
                        length = 1
                        while (n + length) in numSet:
                            length += 1
                        longest = max(length, longest)
                return longest
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "minimum window substring",
        """
        class Solution:
            def minWindow(self, s, t):
                need = Counter(t)
                have = {}
                l = 0
                res, resLen = [-1, -1], float("inf")
                formed = 0
                for r in range(len(s)):
                    c = s[r]
                    have[c] = have.get(c, 0) + 1
                    if c in need and have[c] == need[c]:
                        formed += 1
                    while formed == len(need):
                        if r - l + 1 < resLen:
                            res, resLen = [l, r], r - l + 1
                        have[s[l]] -= 1
                        if s[l] in need and have[s[l]] < need[s[l]]:
                            formed -= 1
                        l += 1
                l, r = res
                return s[l:r + 1] if resLen != float("inf") else ""
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "top k frequent, buckets built by appending (an owner's solution)",
        """
        class Solution:
            def topKFrequent(self, nums: list[int], k: int) -> list[int]:
                count = {}

                for num in nums:
                    count[num] = count.get(num, 0) + 1

                freq = []

                for _ in range(len(nums) + 1):
                    freq.append([])

                for num, counts in count.items():
                    freq[counts].append(num)

                res = []
                for i in range(len(freq) - 1, 0, -1):
                    for num in freq[i]:
                        res.append(num)

                        if len(res) == k:
                            return res
        """,
        "O(n)", "O(n)", "medium",
    ),
    (
        "a grid filled in nested loops is n² items, not buckets",
        """
        class Solution:
            def total(self, n):
                grid = [[] for _ in range(n)]
                for r in range(n):
                    for c in range(n):
                        grid[r].append(r * c)
                s = 0
                for r in range(n):
                    for v in grid[r]:
                        s += v
                return s
        """,
        "O(n²)", "O(n)", "high",
    ),
    (
        "constant work",
        """
        class Solution:
            def addDigits(self, num):
                return 0 if num == 0 else 1 + (num - 1) % 9
        """,
        "O(1)", "O(1)", "high",
    ),
    (
        "a plain function, not a class",
        """
        def missing_number(nums):
            return len(nums) * (len(nums) + 1) // 2 - sum(nums)
        """,
        "O(n)", "O(1)", "high",
    ),
]


@pytest.mark.parametrize(
    ("label", "code", "time", "space", "confidence"), CASES, ids=[c[0] for c in CASES]
)
def test_evaluation_cases(label, code, time, space, confidence):
    result = estimate(code)
    assert result.status == "ok", label
    assert (result.time, result.space, result.confidence) == (time, space, confidence), result.reasons


def test_every_estimate_explains_itself():
    result = estimate(CASES[0][1])
    assert result.reasons
    assert "Estimated by reading the code, without running it." in result.limitations


def test_a_design_class_shows_its_costliest_operation_with_less_confidence():
    result = estimate(
        """
        class MinStack:
            def __init__(self):
                self.stack = []
                self.mins = []

            def push(self, val):
                self.stack.append(val)
                self.mins.append(min(val, self.mins[-1] if self.mins else val))

            def pop(self):
                self.stack.pop()
                self.mins.pop()

            def getMin(self):
                return self.mins[-1]
        """
    )
    assert (result.time, result.confidence) == ("O(1)", "medium")
    assert result.reasons[0].startswith("This is a class with several operations")


def test_code_that_isnt_python_is_reported_not_guessed():
    result = estimate("public class Solution { int x; }")
    assert result.status == "unparseable"
    assert result.time is None


def test_other_languages_are_not_supported_yet():
    assert analyze("java", "class Solution {}") is None
    assert analyze("cpp", "int main() {}") is None


def test_deep_nesting_is_refused_rather_than_crashing():
    code = "def f(x):\n    return " + "(" * 5000 + "x" + ")" * 5000
    assert analyze("python3", code).status == "unparseable"
